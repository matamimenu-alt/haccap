import { Router } from 'express';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, maintenanceSchedules } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const maintenanceSchedulesRouter: Router = Router();
maintenanceSchedulesRouter.use(requireAuth);

const writeRoles = [
  'platform_super_admin', 'company_owner', 'operations_director', 'area_manager', 'branch_manager',
];

// Tenant-wide list — supports "due within N days" for the operations dashboard
maintenanceSchedulesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z
      .object({
        assetId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        dueInDays: z.coerce.number().int().min(0).max(365).optional(),
      })
      .parse(req.query);

    const filters = [eq(maintenanceSchedules.companyId, req.tenant.companyId)];
    if (q.assetId) filters.push(eq(maintenanceSchedules.assetId, q.assetId));
    if (q.categoryId) filters.push(eq(maintenanceSchedules.categoryId, q.categoryId));
    if (q.dueInDays != null) {
      const cutoff = new Date(Date.now() + q.dueInDays * 86400 * 1000);
      filters.push(lte(maintenanceSchedules.nextDueAt, cutoff));
    }
    filters.push(eq(maintenanceSchedules.isActive, true));

    const rows = await db.select().from(maintenanceSchedules).where(and(...filters));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  titleAr: z.string().min(1).max(255).optional(),
  titleEn: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  frequency: z.enum([
    'daily','weekly','biweekly','monthly','bimonthly','quarterly','semi_annually','annually','usage_based','condition_based','custom',
  ]).optional(),
  isActive: z.boolean().optional(),
  nextDueAt: z.string().datetime().optional(),
  playbook: z.record(z.unknown()).optional(),
});

maintenanceSchedulesRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(maintenanceSchedules)
      .set({
        ...patch,
        nextDueAt: patch.nextDueAt ? new Date(patch.nextDueAt) : undefined,
        updatedAt: sql`now()`,
      })
      .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Maintenance schedule');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

maintenanceSchedulesRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .delete(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.companyId, req.tenant.companyId)))
      .returning({ id: maintenanceSchedules.id });
    if (!deleted) throw errors.notFound('Maintenance schedule');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Silence unused-import warning
void isNull;
void scoped;
