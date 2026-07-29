import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, brands } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const brandsRouter: Router = Router();
brandsRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

brandsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(brands)
      .where(scoped(brands.companyId, req.tenant.companyId, brands.deletedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
});

brandsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);
    const [created] = await db
      .insert(brands)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

const patchSchema = createSchema.partial();

brandsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(brands)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(brands.id, id), eq(brands.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Brand');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

brandsRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(brands)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(brands.id, id), eq(brands.companyId, req.tenant.companyId), isNull(brands.deletedAt)))
      .returning({ id: brands.id });
    if (!deleted) throw errors.notFound('Brand');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
