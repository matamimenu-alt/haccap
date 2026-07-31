import { Router } from 'express';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, assetCategories } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const assetCategoriesRouter: Router = Router();
assetCategoriesRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

const assetKind = z.enum([
  'equipment','fixture','furniture','vehicle','signage','tool','sensor','container','facility','other',
]);
const riskLevel = z.enum(['none', 'low', 'medium', 'high', 'critical']);

// List = system categories (companyId NULL) + this tenant's custom categories
assetCategoriesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(assetCategories)
      .where(
        and(
          or(isNull(assetCategories.companyId), eq(assetCategories.companyId, req.tenant.companyId)),
          isNull(assetCategories.deletedAt),
        ),
      );
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  key: z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/),
  nameAr: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  description: z.string().nullable().optional(),
  defaultAssetKind: assetKind.default('equipment'),
  riskLevel: riskLevel.default('low'),
  suggestedSpecs: z
    .array(
      z.object({
        key: z.string(),
        label: z.object({ ar: z.string(), en: z.string() }),
        type: z.string(),
        unit: z.string().optional(),
      }),
    )
    .default([]),
  aiHints: z.record(z.unknown()).optional(),
  iconKey: z.string().max(64).nullable().optional(),
  colorHex: z.string().max(8).nullable().optional(),
});

assetCategoriesRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);

    // Compute path + depth from parent
    let path = input.key;
    let depth = 0;
    if (input.parentId) {
      const [parent] = await db
        .select({ path: assetCategories.path, depth: assetCategories.depth })
        .from(assetCategories)
        .where(eq(assetCategories.id, input.parentId))
        .limit(1);
      if (!parent) throw errors.notFound('Parent category');
      path = `${parent.path}/${input.key}`;
      depth = parent.depth + 1;
    }

    const [created] = await db
      .insert(assetCategories)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        path,
        depth,
        isSystem: false,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

const patchSchema = createSchema
  .omit({ parentId: true, key: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

assetCategoriesRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(assetCategories)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(
        and(
          eq(assetCategories.id, id),
          eq(assetCategories.companyId, req.tenant.companyId),
          isNull(assetCategories.deletedAt),
        ),
      )
      .returning();
    if (!updated) throw errors.notFound('Asset category');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

assetCategoriesRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(assetCategories)
      .set({ deletedAt: sql`now()` })
      .where(
        and(
          eq(assetCategories.id, id),
          eq(assetCategories.companyId, req.tenant.companyId),
          isNull(assetCategories.deletedAt),
        ),
      )
      .returning({ id: assetCategories.id });
    if (!deleted) throw errors.notFound('Asset category');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
