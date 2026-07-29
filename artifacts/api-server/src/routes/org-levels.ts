import { Router } from 'express';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, orgLevels } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const orgLevelsRouter: Router = Router();
orgLevelsRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner'];

orgLevelsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(orgLevels)
      .where(scoped(orgLevels.companyId, req.tenant.companyId, orgLevels.deletedAt))
      .orderBy(asc(orgLevels.depth));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  depth: z.number().int().min(0).max(10),
  nameAr: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  parentLevelId: z.string().uuid().nullable().optional(),
});

orgLevelsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = upsertSchema.parse(req.body);
    const [created] = await db
      .insert(orgLevels)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

orgLevelsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = upsertSchema.partial().parse(req.body);
    const [updated] = await db
      .update(orgLevels)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(orgLevels.id, id), eq(orgLevels.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Org level');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

orgLevelsRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(orgLevels)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(orgLevels.id, id), eq(orgLevels.companyId, req.tenant.companyId), isNull(orgLevels.deletedAt)))
      .returning({ id: orgLevels.id });
    if (!deleted) throw errors.notFound('Org level');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
