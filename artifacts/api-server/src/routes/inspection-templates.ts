import { Router } from 'express';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, inspectionTemplates } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const inspectionTemplatesRouter: Router = Router();
inspectionTemplatesRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'food_safety_officer', 'internal_auditor'];

const kind = z.enum([
  'internal_audit','municipality_prep','municipality_visit','sfda_audit','haccp_audit',
  'food_safety_check','daily_walkthrough','safety_audit','supplier_audit','training_audit','other',
]);

const sectionSchema = z.object({
  key: z.string(),
  labelAr: z.string(),
  labelEn: z.string(),
  weight: z.number().positive().optional(),
  order: z.number().int().optional(),
});
const itemSchema = z.object({
  key: z.string(),
  sectionKey: z.string(),
  labelAr: z.string(),
  labelEn: z.string(),
  type: z.enum(['yesno', 'scale5', 'numeric', 'text']),
  weight: z.number().positive().optional(),
  critical: z.boolean().optional(),
  allowNA: z.boolean().optional(),
  evidenceRequiredOnFail: z.boolean().optional(),
  passIf: z
    .object({
      op: z.enum(['gte', 'lte', 'between']),
      value: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  unit: z.string().optional(),
});

inspectionTemplatesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(inspectionTemplates)
      .where(
        and(
          or(isNull(inspectionTemplates.companyId), eq(inspectionTemplates.companyId, req.tenant.companyId)),
          isNull(inspectionTemplates.deletedAt),
        ),
      )
      .orderBy(desc(inspectionTemplates.updatedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

inspectionTemplatesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(inspectionTemplates)
      .where(and(eq(inspectionTemplates.id, id), or(isNull(inspectionTemplates.companyId), eq(inspectionTemplates.companyId, req.tenant.companyId))))
      .limit(1);
    if (!row) throw errors.notFound('Template');
    res.json(ok(row));
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  kind: kind.default('internal_audit'),
  issuingAuthority: z.string().max(128).nullable().optional(),
  regulatoryRef: z.string().max(128).nullable().optional(),
  passThreshold: z.number().int().min(0).max(100).default(80),
  sections: z.array(sectionSchema).min(1),
  items: z.array(itemSchema).min(1),
  scopeTargets: z.array(z.string()).default(['branch']),
  aiHints: z.record(z.unknown()).optional(),
});

inspectionTemplatesRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = upsertSchema.parse(req.body);
    const [created] = await db
      .insert(inspectionTemplates)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

inspectionTemplatesRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = upsertSchema.partial().parse(req.body);
    const [updated] = await db
      .update(inspectionTemplates)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(inspectionTemplates.id, id), eq(inspectionTemplates.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Template');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});
