import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, departments } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const departmentsRouter: Router = Router();
departmentsRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

departmentsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(departments)
      .where(scoped(departments.companyId, req.tenant.companyId, departments.deletedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  nameAr: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  code: z.string().max(32).nullable().optional(),
});

departmentsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = upsertSchema.parse(req.body);
    const [created] = await db
      .insert(departments)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

departmentsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = upsertSchema.partial().parse(req.body);
    const [updated] = await db
      .update(departments)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(departments.id, id), eq(departments.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Department');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

departmentsRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(departments)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(departments.id, id), eq(departments.companyId, req.tenant.companyId), isNull(departments.deletedAt)))
      .returning({ id: departments.id });
    if (!deleted) throw errors.notFound('Department');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
