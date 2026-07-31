import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, areas, branches } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const areasRouter: Router = Router();
areasRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'area_manager'];

const areaKind = z.enum([
  'kitchen','cook_line','prep','dishwash','cold_storage','freezer','dry_storage',
  'receiving','waste','mechanical','dining','restroom','office','front_of_house','outdoor','other',
]);
const riskLevel = z.enum(['none', 'low', 'medium', 'high', 'critical']);

areasRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const branchId = req.query.branchId ? z.string().uuid().parse(req.query.branchId) : null;
    const base = branchId
      ? and(eq(areas.branchId, branchId), eq(areas.companyId, req.tenant.companyId), isNull(areas.deletedAt))
      : scoped(areas.companyId, req.tenant.companyId, areas.deletedAt);
    const rows = await db.select().from(areas).where(base);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  branchId: z.string().uuid(),
  parentAreaId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(32),
  nameAr: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  kind: areaKind.default('other'),
  description: z.string().nullable().optional(),
  riskLevel: riskLevel.default('low'),
  complianceScope: z.array(z.string()).default([]),
  targetTempMinC: z.string().max(8).nullable().optional(),
  targetTempMaxC: z.string().max(8).nullable().optional(),
  targetHumidityPct: z.string().max(8).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

areasRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);

    // Verify the branch belongs to this tenant
    const [branch] = await db
      .select({ id: branches.id, city: branches.city })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.companyId, req.tenant.companyId)))
      .limit(1);
    if (!branch) throw errors.notFound('Branch');

    const aiMetadata = {
      kind: input.kind,
      riskLevel: input.riskLevel,
      complianceScope: input.complianceScope,
      hasTemperatureTarget: input.targetTempMinC != null || input.targetTempMaxC != null,
    };
    const aiSummary = `${input.nameEn} (${input.kind}) — ${branch.city}`;

    const [created] = await db
      .insert(areas)
      .values({ ...input, companyId: req.tenant.companyId, aiSummary, aiMetadata })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

const patchSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

areasRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(areas)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(areas.id, id), eq(areas.companyId, req.tenant.companyId), isNull(areas.deletedAt)))
      .returning();
    if (!updated) throw errors.notFound('Area');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

areasRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(areas)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(areas.id, id), eq(areas.companyId, req.tenant.companyId), isNull(areas.deletedAt)))
      .returning({ id: areas.id });
    if (!deleted) throw errors.notFound('Area');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
