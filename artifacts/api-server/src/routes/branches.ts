import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, branches } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const branchesRouter: Router = Router();
branchesRouter.use(requireAuth);

const writeRoles = [
  'platform_super_admin',
  'company_owner',
  'operations_director',
  'area_manager',
];

const restaurantType = z.enum([
  'fast_food', 'casual_dining', 'fine_dining', 'shawarma',
  'bakery', 'coffee_shop', 'buffet', 'cloud_kitchen', 'catering', 'other',
]);

const branchStatus = z.enum([
  'active', 'inactive', 'closed_for_renovation', 'permanently_closed',
]);

branchesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(branches)
      .where(scoped(branches.companyId, req.tenant.companyId, branches.deletedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

branchesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.companyId, req.tenant.companyId), isNull(branches.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Branch');
    res.json(ok(row));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  brandId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(32),
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  restaurantType: restaurantType.default('other'),
  status: branchStatus.default('active'),
  city: z.string().min(1).max(128),
  region: z.string().max(128).nullable().optional(),
  addressLine: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  municipalityLicenseNumber: z.string().max(100).nullable().optional(),
  municipalityLicenseExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  seatingCapacity: z.number().int().nonnegative().nullable().optional(),
  staffHeadcount: z.number().int().nonnegative().nullable().optional(),
});

branchesRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);
    const [created] = await db
      .insert(branches)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        latitude: input.latitude != null ? String(input.latitude) : null,
        longitude: input.longitude != null ? String(input.longitude) : null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

const patchSchema = createSchema.partial();

branchesRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(branches)
      .set({
        ...patch,
        latitude: patch.latitude != null ? String(patch.latitude) : patch.latitude,
        longitude: patch.longitude != null ? String(patch.longitude) : patch.longitude,
        updatedAt: sql`now()`,
      })
      .where(and(eq(branches.id, id), eq(branches.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Branch');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

branchesRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(branches)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(branches.id, id), eq(branches.companyId, req.tenant.companyId), isNull(branches.deletedAt)))
      .returning({ id: branches.id });
    if (!deleted) throw errors.notFound('Branch');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
