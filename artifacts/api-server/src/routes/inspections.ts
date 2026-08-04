import { Router } from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  branches,
  findings,
  inspectionEvents,
  inspectionResponses,
  inspectionTemplates,
  inspections,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';
import { materializeFindingsFromResponses, recomputeInspection, scoreResponse } from '../services/inspection-scoring.js';

export const inspectionsRouter: Router = Router();
inspectionsRouter.use(requireAuth);

const writeRoles = [
  'platform_super_admin', 'company_owner', 'operations_director',
  'area_manager', 'branch_manager', 'food_safety_officer', 'internal_auditor', 'inspector',
];
const finalizeRoles = [
  'platform_super_admin', 'company_owner', 'operations_director',
  'food_safety_officer', 'internal_auditor',
];

const polymorphicTarget = z.enum([
  'asset', 'area', 'branch', 'brand', 'company', 'supplier',
  'warranty', 'maintenance_schedule', 'inspection', 'task', 'incident',
]);
const kind = z.enum([
  'internal_audit','municipality_prep','municipality_visit','sfda_audit','haccp_audit',
  'food_safety_check','daily_walkthrough','safety_audit','supplier_audit','training_audit','other',
]);

// -------- LIST --------
inspectionsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z
      .object({
        branchId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'in_progress', 'submitted', 'finalized', 'cancelled']).optional(),
        kind: kind.optional(),
      })
      .parse(req.query);
    const filters = [eq(inspections.companyId, req.tenant.companyId), isNull(inspections.deletedAt)];
    if (q.branchId) filters.push(eq(inspections.branchId, q.branchId));
    if (q.status) filters.push(eq(inspections.status, q.status));
    if (q.kind) filters.push(eq(inspections.kind, q.kind));
    const rows = await db.select().from(inspections).where(and(...filters)).orderBy(desc(inspections.createdAt)).limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

// -------- GET one --------
inspectionsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(inspections)
      .where(and(eq(inspections.id, id), eq(inspections.companyId, req.tenant.companyId), isNull(inspections.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Inspection');

    const responses = await db.select().from(inspectionResponses).where(eq(inspectionResponses.inspectionId, id));
    const fnds = await db.select().from(findings).where(eq(findings.inspectionId, id));

    res.json(ok({ ...row, responses, findings: fnds }));
  } catch (err) {
    next(err);
  }
});

// -------- CREATE (from a template) --------
const createSchema = z.object({
  branchId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  targetType: polymorphicTarget.default('branch'),
  targetId: z.string().uuid(),
  templateId: z.string().uuid(),
  scheduledFor: z.string().datetime().nullable().optional(),
  reference: z.string().max(128).nullable().optional(),
});

inspectionsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);

    const [tpl] = await db.select().from(inspectionTemplates).where(eq(inspectionTemplates.id, input.templateId)).limit(1);
    if (!tpl) throw errors.notFound('Template');

    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.companyId, req.tenant.companyId)))
      .limit(1);
    if (!branch) throw errors.notFound('Branch');

    const snapshot = {
      sections: tpl.sections,
      items: tpl.items,
      passThreshold: tpl.passThreshold,
    };

    const [created] = await db
      .insert(inspections)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        areaId: input.areaId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        templateId: tpl.id,
        templateVersion: tpl.version,
        templateSnapshot: snapshot,
        kind: tpl.kind,
        titleEn: tpl.titleEn,
        titleAr: tpl.titleAr,
        status: input.scheduledFor ? 'scheduled' : 'in_progress',
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        startedAt: input.scheduledFor ? null : new Date(),
        reference: input.reference ?? null,
        inspectorUserId: req.tenant.userId,
        aiSummary: `${tpl.titleEn} — ${tpl.kind}`,
        aiMetadata: { templateKey: tpl.key, kind: tpl.kind, issuingAuthority: tpl.issuingAuthority },
      })
      .returning();

    // Pre-seed empty response rows so the UI has stable ids to PATCH against
    for (const item of tpl.items ?? []) {
      await db.insert(inspectionResponses).values({
        companyId: req.tenant.companyId,
        inspectionId: created.id,
        itemKey: item.key,
        sectionKey: item.sectionKey,
        itemSnapshot: item as unknown as Record<string, unknown>,
        isCritical: !!item.critical,
      });
    }

    await db.insert(inspectionEvents).values({
      companyId: req.tenant.companyId,
      inspectionId: created.id,
      eventType: 'created',
      actorUserId: req.tenant.userId,
      payload: { templateKey: tpl.key },
    });

    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// -------- RESPONSE PATCH --------
const responseSchema = z.object({
  value: z.enum(['pass', 'fail', 'partial', 'not_applicable', 'observed']),
  numericValue: z.number().nullable().optional(),
  textValue: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

inspectionsRouter.patch('/:id/responses/:itemKey', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const itemKey = z.string().min(1).max(128).parse(req.params.itemKey);
    const input = responseSchema.parse(req.body);

    const [inspection] = await db.select().from(inspections).where(and(eq(inspections.id, id), eq(inspections.companyId, req.tenant.companyId))).limit(1);
    if (!inspection) throw errors.notFound('Inspection');
    if (inspection.status === 'finalized' || inspection.status === 'cancelled') {
      throw errors.badRequest({ ar: 'التفتيش مغلق', en: 'Inspection is closed' });
    }

    const snapshot = inspection.templateSnapshot as { items: Array<Parameters<typeof scoreResponse>[0]> };
    const item = (snapshot.items ?? []).find((i) => i.key === itemKey);
    if (!item) throw errors.notFound('Item');

    const { score, isPass } = scoreResponse(item, input);

    const [updated] = await db
      .update(inspectionResponses)
      .set({
        value: input.value,
        numericValue: input.numericValue != null ? String(input.numericValue) : null,
        textValue: input.textValue ?? null,
        note: input.note ?? null,
        isPass,
        score: String(score),
        respondedByUserId: req.tenant.userId,
        respondedAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(and(eq(inspectionResponses.inspectionId, id), eq(inspectionResponses.itemKey, itemKey)))
      .returning();

    if (inspection.status === 'scheduled') {
      await db.update(inspections).set({ status: 'in_progress', startedAt: new Date() }).where(eq(inspections.id, id));
    }

    await recomputeInspection(id);

    await db.insert(inspectionEvents).values({
      companyId: req.tenant.companyId,
      inspectionId: id,
      eventType: 'response_recorded',
      actorUserId: req.tenant.userId,
      payload: { itemKey, value: input.value, isPass },
    });

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// -------- Submit --------
inspectionsRouter.post('/:id/submit', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [before] = await db.select().from(inspections).where(and(eq(inspections.id, id), eq(inspections.companyId, req.tenant.companyId))).limit(1);
    if (!before) throw errors.notFound('Inspection');
    if (before.status !== 'in_progress') throw errors.badRequest({ ar: 'الحالة غير صحيحة', en: 'Invalid status transition' });

    const body = z.object({ notes: z.string().nullable().optional() }).parse(req.body ?? {});
    await recomputeInspection(id);
    const [updated] = await db
      .update(inspections)
      .set({ status: 'submitted', submittedAt: new Date(), notes: body.notes ?? null, updatedAt: sql`now()` })
      .where(eq(inspections.id, id))
      .returning();

    await db.insert(inspectionEvents).values({
      companyId: req.tenant.companyId, inspectionId: id, eventType: 'submitted',
      actorUserId: req.tenant.userId, payload: { notes: body.notes ?? null },
    });

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// -------- Finalize --------
inspectionsRouter.post('/:id/finalize', requireRole(...finalizeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [before] = await db.select().from(inspections).where(and(eq(inspections.id, id), eq(inspections.companyId, req.tenant.companyId))).limit(1);
    if (!before) throw errors.notFound('Inspection');
    if (before.status !== 'submitted' && before.status !== 'in_progress') {
      throw errors.badRequest({ ar: 'الحالة غير صحيحة', en: 'Invalid status transition' });
    }

    const body = z.object({ verdict: z.string().nullable().optional() }).parse(req.body ?? {});
    await recomputeInspection(id);
    const [updated] = await db
      .update(inspections)
      .set({
        status: 'finalized',
        finalizedAt: new Date(),
        reviewerUserId: req.tenant.userId,
        verdict: body.verdict ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(inspections.id, id))
      .returning();

    await materializeFindingsFromResponses(id, req.tenant.userId);

    await db.insert(inspectionEvents).values({
      companyId: req.tenant.companyId, inspectionId: id, eventType: 'finalized',
      actorUserId: req.tenant.userId, payload: { verdict: body.verdict ?? null, score: updated.overallScore, passed: updated.overallPass },
    });

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// -------- Events --------
inspectionsRouter.get('/:id/events', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(inspectionEvents)
      .where(and(eq(inspectionEvents.inspectionId, id), eq(inspectionEvents.companyId, req.tenant.companyId)))
      .orderBy(desc(inspectionEvents.createdAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

// Suppress unused
void scoped;
