import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, assetTags } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const assetTagsRouter: Router = Router();
assetTagsRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

assetTagsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(assetTags)
      .where(scoped(assetTags.companyId, req.tenant.companyId));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  labelAr: z.string().min(1).max(64),
  labelEn: z.string().min(1).max(64),
  colorHex: z.string().max(8).nullable().optional(),
});

assetTagsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = upsertSchema.parse(req.body);
    const [created] = await db
      .insert(assetTags)
      .values({ ...input, companyId: req.tenant.companyId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

assetTagsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = upsertSchema.partial().parse(req.body);
    const [updated] = await db
      .update(assetTags)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(assetTags.id, id), eq(assetTags.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Tag');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

assetTagsRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .delete(assetTags)
      .where(and(eq(assetTags.id, id), eq(assetTags.companyId, req.tenant.companyId)))
      .returning({ id: assetTags.id });
    if (!deleted) throw errors.notFound('Tag');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
