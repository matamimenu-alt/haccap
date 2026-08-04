import { Router } from 'express';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, taskTemplates } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const taskTemplatesRouter: Router = Router();
taskTemplatesRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'food_safety_officer'];

const kind = z.enum([
  'maintenance','inspection_followup','capa_action','incident_response','compliance',
  'sanitation','training','safety_check','calibration','ad_hoc','other',
]);
const priority = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const risk = z.enum(['none', 'low', 'medium', 'high', 'critical']);

taskTemplatesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(taskTemplates)
      .where(
        and(
          or(isNull(taskTemplates.companyId), eq(taskTemplates.companyId, req.tenant.companyId)),
          isNull(taskTemplates.deletedAt),
        ),
      );
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  kind: kind.default('maintenance'),
  defaultPriority: priority.default('normal'),
  defaultRisk: risk.default('medium'),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  requiresEvidence: z.boolean().default(false),
  requiresSignature: z.boolean().default(false),
  requiresVerification: z.boolean().default(false),
  checklistItems: z
    .array(
      z.object({
        key: z.string(),
        labelAr: z.string(),
        labelEn: z.string(),
        required: z.boolean(),
        type: z.string(),
      }),
    )
    .default([]),
  requiredAttachments: z
    .array(
      z.object({
        kind: z.string(),
        minCount: z.number().int().min(1),
        labelAr: z.string(),
        labelEn: z.string(),
      }),
    )
    .default([]),
  playbook: z.record(z.unknown()).optional(),
  aiHints: z.record(z.unknown()).optional(),
});

taskTemplatesRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = upsertSchema.parse(req.body);
    const [created] = await db
      .insert(taskTemplates)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

taskTemplatesRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = upsertSchema.partial().parse(req.body);
    const [updated] = await db
      .update(taskTemplates)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Task template');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

taskTemplatesRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(taskTemplates)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.companyId, req.tenant.companyId), isNull(taskTemplates.deletedAt)))
      .returning({ id: taskTemplates.id });
    if (!deleted) throw errors.notFound('Task template');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
