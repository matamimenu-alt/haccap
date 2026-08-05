import { Router } from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  ccpMonitoringLogs,
  ccps,
  hazards,
  haccpPlans,
  verificationRecords,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';
import { evaluateReadingAgainstLimits, materializeCcpDeviation } from '../services/ccp-monitoring.js';

export const haccpRouter: Router = Router();
haccpRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'food_safety_officer', 'internal_auditor'];
const monitorRoles = [
  'platform_super_admin', 'company_owner', 'operations_director', 'area_manager', 'branch_manager',
  'food_safety_officer', 'supervisor', 'employee',
];

const hazardType = z.enum(['biological', 'chemical', 'physical', 'allergen', 'radiological']);
const hazardStage = z.enum([
  'receiving','storage_cold','storage_dry','thawing','prep','cooking','holding_hot','holding_cold',
  'cooling','reheating','service','packaging','transport','cleaning','other',
]);
const planStatus = z.enum(['draft', 'under_review', 'approved', 'active', 'superseded', 'archived']);

/* ------------------------- PLANS ------------------------- */

haccpRouter.get('/plans', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(haccpPlans)
      .where(scoped(haccpPlans.companyId, req.tenant.companyId, haccpPlans.deletedAt))
      .orderBy(desc(haccpPlans.updatedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

haccpRouter.get('/plans/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [plan] = await db
      .select()
      .from(haccpPlans)
      .where(and(eq(haccpPlans.id, id), eq(haccpPlans.companyId, req.tenant.companyId), isNull(haccpPlans.deletedAt)))
      .limit(1);
    if (!plan) throw errors.notFound('Plan');
    const planHazards = await db.select().from(hazards).where(eq(hazards.haccpPlanId, id));
    const planCcps = await db.select().from(ccps).where(eq(ccps.haccpPlanId, id));
    const verifications = await db.select().from(verificationRecords).where(eq(verificationRecords.haccpPlanId, id)).orderBy(desc(verificationRecords.performedAt)).limit(50);
    res.json(ok({ ...plan, hazards: planHazards, ccps: planCcps, verifications }));
  } catch (err) {
    next(err);
  }
});

const planSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  reference: z.string().min(1).max(64),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  productDescription: z.string().nullable().optional(),
  intendedUse: z.string().nullable().optional(),
  status: planStatus.default('draft'),
  scopeProducts: z.array(z.object({ nameEn: z.string(), nameAr: z.string().optional(), category: z.string().optional() })).default([]),
  scopeProcesses: z.array(z.string()).default([]),
  teamMembers: z.array(z.object({ userId: z.string().uuid().optional(), name: z.string(), role: z.string(), responsibilities: z.array(z.string()).optional() })).default([]),
  prerequisitePrograms: z.array(z.string()).default([]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reviewDueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

haccpRouter.post('/plans', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = planSchema.parse(req.body);
    const [created] = await db
      .insert(haccpPlans)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        aiSummary: `${input.titleEn} — ${input.scopeProducts.map((p) => p.nameEn).join(', ')}`,
        aiMetadata: { productCount: input.scopeProducts.length, processCount: input.scopeProcesses.length, teamSize: input.teamMembers.length },
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

haccpRouter.patch('/plans/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = planSchema.partial().parse(req.body);
    const [updated] = await db
      .update(haccpPlans)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(haccpPlans.id, id), eq(haccpPlans.companyId, req.tenant.companyId), isNull(haccpPlans.deletedAt)))
      .returning();
    if (!updated) throw errors.notFound('Plan');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- HAZARDS ------------------------- */

const hazardSchema = z.object({
  haccpPlanId: z.string().uuid(),
  type: hazardType,
  stage: hazardStage,
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  agent: z.string().max(128).nullable().optional(),
  severity: z.number().int().min(1).max(5).default(3),
  likelihood: z.number().int().min(1).max(5).default(3),
  isSignificant: z.boolean().optional(),
  justification: z.string().nullable().optional(),
  preventiveMeasures: z.array(z.string()).default([]),
  controlMeasures: z.array(z.string()).default([]),
  reference: z.string().max(32).nullable().optional(),
});

haccpRouter.get('/plans/:id/hazards', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(hazards).where(and(eq(hazards.haccpPlanId, id), eq(hazards.companyId, req.tenant.companyId)));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

haccpRouter.post('/hazards', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = hazardSchema.parse(req.body);
    const riskScore = input.severity * input.likelihood;
    const isSig = input.isSignificant ?? riskScore >= 8;
    const [created] = await db
      .insert(hazards)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        riskScore,
        isSignificant: isSig,
        aiMetadata: { riskScore, type: input.type, stage: input.stage },
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- CCPs ------------------------- */

const ccpSchema = z.object({
  haccpPlanId: z.string().uuid(),
  assetId: z.string().uuid().nullable().optional(),
  reference: z.string().min(1).max(32),
  number: z.number().int().positive(),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  stage: hazardStage,
  description: z.string().nullable().optional(),
  hazardIds: z.array(z.string().uuid()).default([]),
  criticalLimits: z.array(z.object({
    metric: z.string(),
    op: z.enum(['gte', 'lte', 'between', 'eq']),
    value: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
    labelEn: z.string().optional(),
    labelAr: z.string().optional(),
  })).min(1),
  monitoring: z.object({
    frequency: z.string(),
    method: z.string(),
    responsibleRoleKey: z.string().optional(),
    procedureRef: z.string().optional(),
  }),
  correctiveActionPlaybook: z.array(z.object({
    step: z.string(),
    ownerRoleKey: z.string().optional(),
    deadlineMinutes: z.number().int().positive().optional(),
  })).default([]),
  verificationPlan: z.object({
    frequency: z.string().optional(),
    method: z.string().optional(),
    recordType: z.string().optional(),
  }).optional(),
});

haccpRouter.get('/plans/:id/ccps', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(ccps).where(and(eq(ccps.haccpPlanId, id), eq(ccps.companyId, req.tenant.companyId)));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

haccpRouter.get('/ccps/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [ccp] = await db.select().from(ccps).where(and(eq(ccps.id, id), eq(ccps.companyId, req.tenant.companyId))).limit(1);
    if (!ccp) throw errors.notFound('CCP');
    const logs = await db.select().from(ccpMonitoringLogs).where(eq(ccpMonitoringLogs.ccpId, id)).orderBy(desc(ccpMonitoringLogs.observedAt)).limit(100);
    // Mark flagged in hazards table
    if (ccp.hazardIds.length > 0) {
      await db.update(hazards).set({ isCcp: true }).where(sql`${hazards.id} = ANY(${ccp.hazardIds})`);
    }
    res.json(ok({ ...ccp, monitoringLogs: logs }));
  } catch (err) {
    next(err);
  }
});

haccpRouter.post('/ccps', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = ccpSchema.parse(req.body);
    const [created] = await db
      .insert(ccps)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        aiMetadata: { limitCount: input.criticalLimits.length, frequency: input.monitoring.frequency },
      })
      .returning();
    // Flag linked hazards as CCP-controlled
    if (input.hazardIds.length > 0) {
      await db.update(hazards).set({ isCcp: true }).where(sql`${hazards.id} = ANY(${input.hazardIds}::uuid[])`);
    }
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- CCP MONITORING ------------------------- */

const monitoringSchema = z.object({
  ccpId: z.string().uuid(),
  branchId: z.string().uuid(),
  assetId: z.string().uuid().nullable().optional(),
  readings: z.record(z.union([z.number(), z.string(), z.null()])),
  observedAt: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  correctiveActionTaken: z.string().nullable().optional(),
});

haccpRouter.post('/ccp-monitoring', requireRole(...monitorRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = monitoringSchema.parse(req.body);

    const [ccp] = await db.select().from(ccps).where(and(eq(ccps.id, input.ccpId), eq(ccps.companyId, req.tenant.companyId))).limit(1);
    if (!ccp) throw errors.notFound('CCP');

    const evaluation = evaluateReadingAgainstLimits(input.readings, ccp.criticalLimits);
    const isDeviation = evaluation.result !== 'in_limit';

    // Choose a primary value for chart-friendliness
    const primaryMetric = ccp.criticalLimits[0]?.metric;
    const primary = primaryMetric ? input.readings[primaryMetric] : null;

    const [log] = await db
      .insert(ccpMonitoringLogs)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        ccpId: input.ccpId,
        assetId: input.assetId ?? ccp.assetId ?? null,
        readings: input.readings,
        primaryValue: primary != null && primary !== '' ? String(Number(primary)) : null,
        primaryUnit: primaryMetric ? (ccp.criticalLimits[0]?.unit ?? null) : null,
        result: evaluation.result,
        isDeviation,
        deviationDetails: isDeviation ? { violations: evaluation.violations } : {},
        correctiveActionTaken: input.correctiveActionTaken ?? null,
        observedByUserId: req.tenant.userId,
        observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
        notes: input.notes ?? null,
      })
      .returning();

    // On deviation, auto-generate finding + CAPA task
    if (isDeviation) {
      await materializeCcpDeviation(log.id, req.tenant.userId);
    }

    res.status(201).json(ok(log));
  } catch (err) {
    next(err);
  }
});

haccpRouter.get('/ccp-monitoring', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z.object({
      ccpId: z.string().uuid().optional(),
      branchId: z.string().uuid().optional(),
      deviationsOnly: z.coerce.boolean().optional(),
    }).parse(req.query);
    const filters = [eq(ccpMonitoringLogs.companyId, req.tenant.companyId)];
    if (q.ccpId) filters.push(eq(ccpMonitoringLogs.ccpId, q.ccpId));
    if (q.branchId) filters.push(eq(ccpMonitoringLogs.branchId, q.branchId));
    if (q.deviationsOnly) filters.push(eq(ccpMonitoringLogs.isDeviation, true));
    const rows = await db
      .select()
      .from(ccpMonitoringLogs)
      .where(and(...filters))
      .orderBy(desc(ccpMonitoringLogs.observedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- VERIFICATION ------------------------- */

const verificationSchema = z.object({
  haccpPlanId: z.string().uuid().nullable().optional(),
  ccpId: z.string().uuid().nullable().optional(),
  kind: z.enum(['plan_review', 'record_review', 'calibration', 'validation_study', 'audit', 'trend_analysis']),
  titleEn: z.string().min(1).max(255),
  titleAr: z.string().min(1).max(255),
  performedAt: z.string().datetime(),
  outcome: z.string().nullable().optional(),
  isEffective: z.boolean().default(true),
  findingsSummary: z.string().nullable().optional(),
  nextDueOn: z.string().datetime().nullable().optional(),
});

haccpRouter.post('/verifications', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = verificationSchema.parse(req.body);
    const [created] = await db
      .insert(verificationRecords)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        performedByUserId: req.tenant.userId,
        performedAt: new Date(input.performedAt),
        nextDueOn: input.nextDueOn ? new Date(input.nextDueOn) : null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});
