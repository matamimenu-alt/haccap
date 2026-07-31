import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  areas,
  assetCategories,
  assetEvents,
  assetQrCodes,
  assetTagAssignments,
  assetTags,
  assets,
  branches,
  suppliers,
  warranties,
  maintenanceSchedules,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';
import { composeAssetAiFields, emitAssetEvent, shallowDiff } from '../services/asset-events.js';
import { env } from '../config/env.js';

export const assetsRouter: Router = Router();
assetsRouter.use(requireAuth);

const writeRoles = [
  'platform_super_admin', 'company_owner', 'operations_director', 'area_manager', 'branch_manager',
];
const decommissionRoles = [
  'platform_super_admin', 'company_owner', 'operations_director',
];

const assetKind = z.enum([
  'equipment','fixture','furniture','vehicle','signage','tool','sensor','container','facility','other',
]);
const assetStatus = z.enum([
  'operational','needs_repair','under_maintenance','out_of_service','in_storage','decommissioned',
]);
const criticality = z.enum(['low', 'medium', 'high', 'critical']);
const riskLevel = z.enum(['none', 'low', 'medium', 'high', 'critical']);

const listQuery = z.object({
  branchId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: assetStatus.optional(),
  criticality: criticality.optional(),
  kind: assetKind.optional(),
  supplierId: z.string().uuid().optional(),
  q: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

async function generateUniqueQrToken(): Promise<string> {
  return randomBytes(18).toString('base64url');
}

// LIST — supports filters + pagination + FTS
assetsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = listQuery.parse(req.query);
    const filters = [eq(assets.companyId, req.tenant.companyId), isNull(assets.deletedAt)];
    if (q.branchId)     filters.push(eq(assets.branchId, q.branchId));
    if (q.areaId)       filters.push(eq(assets.areaId, q.areaId));
    if (q.categoryId)   filters.push(eq(assets.categoryId, q.categoryId));
    if (q.status)       filters.push(eq(assets.status, q.status));
    if (q.criticality)  filters.push(eq(assets.criticality, q.criticality));
    if (q.kind)         filters.push(eq(assets.kind, q.kind));
    if (q.supplierId)   filters.push(eq(assets.supplierId, q.supplierId));
    if (q.q) {
      const term = q.q.toLowerCase();
      filters.push(sql`${assets.searchText} LIKE ${'%' + term + '%'}`);
    }

    const where = and(...filters);
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(assets)
      .where(where);

    const rows = await db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    res.json(
      ok(rows, {
        page: q.page,
        pageSize: q.pageSize,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / q.pageSize),
      }),
    );
  } catch (err) {
    next(err);
  }
});

// GET one — hydrates joined labels for a rich detail view
assetsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select({
        asset: assets,
        branchNameEn: branches.nameEn,
        branchNameAr: branches.nameAr,
        areaNameEn: areas.nameEn,
        areaNameAr: areas.nameAr,
        areaKind: areas.kind,
        categoryPath: assetCategories.path,
        categoryNameEn: assetCategories.nameEn,
        categoryNameAr: assetCategories.nameAr,
        supplierNameEn: suppliers.nameEn,
      })
      .from(assets)
      .leftJoin(branches, eq(branches.id, assets.branchId))
      .leftJoin(areas, eq(areas.id, assets.areaId))
      .leftJoin(assetCategories, eq(assetCategories.id, assets.categoryId))
      .leftJoin(suppliers, eq(suppliers.id, assets.supplierId))
      .where(and(eq(assets.id, id), eq(assets.companyId, req.tenant.companyId), isNull(assets.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Asset');

    const [activeQr] = await db
      .select()
      .from(assetQrCodes)
      .where(
        and(
          eq(assetQrCodes.assetId, id),
          eq(assetQrCodes.isActive, true),
          isNull(assetQrCodes.revokedAt),
        ),
      )
      .limit(1);

    const tags = await db
      .select({ id: assetTags.id, key: assetTags.key, labelEn: assetTags.labelEn, labelAr: assetTags.labelAr, colorHex: assetTags.colorHex })
      .from(assetTagAssignments)
      .innerJoin(assetTags, eq(assetTags.id, assetTagAssignments.tagId))
      .where(eq(assetTagAssignments.assetId, id));

    res.json(
      ok({
        ...row.asset,
        branch: { id: row.asset.branchId, nameEn: row.branchNameEn, nameAr: row.branchNameAr },
        area: row.asset.areaId
          ? { id: row.asset.areaId, nameEn: row.areaNameEn, nameAr: row.areaNameAr, kind: row.areaKind }
          : null,
        category: row.asset.categoryId
          ? { id: row.asset.categoryId, path: row.categoryPath, nameEn: row.categoryNameEn, nameAr: row.categoryNameAr }
          : null,
        supplier: row.asset.supplierId ? { id: row.asset.supplierId, nameEn: row.supplierNameEn } : null,
        activeQr: activeQr
          ? { token: activeQr.token, scanUrl: `${env.QR_SCAN_BASE_URL}/${activeQr.token}` }
          : null,
        tags,
      }),
    );
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  branchId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  kind: assetKind.default('equipment'),
  code: z.string().min(1).max(64),
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  manufacturer: z.string().max(128).nullable().optional(),
  model: z.string().max(128).nullable().optional(),
  serialNumber: z.string().max(128).nullable().optional(),
  barcode: z.string().max(128).nullable().optional(),
  spec: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  status: assetStatus.default('operational'),
  criticality: criticality.default('medium'),
  riskLevel: riskLevel.default('low'),
  supplierId: z.string().uuid().nullable().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  purchaseCost: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('SAR'),
  installedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expectedLifespanMonths: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// CREATE — verifies branch/area/category tenancy, mints an active QR, and
// emits an immutable "created" event
assetsRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);

    const [branch] = await db
      .select({ id: branches.id, city: branches.city })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.companyId, req.tenant.companyId)))
      .limit(1);
    if (!branch) throw errors.notFound('Branch');

    let areaKind: string | null = null;
    if (input.areaId) {
      const [a] = await db
        .select({ id: areas.id, kind: areas.kind })
        .from(areas)
        .where(and(eq(areas.id, input.areaId), eq(areas.branchId, input.branchId), isNull(areas.deletedAt)))
        .limit(1);
      if (!a) throw errors.badRequest({ ar: 'المنطقة لا تنتمي إلى الفرع', en: 'Area does not belong to branch' });
      areaKind = a.kind;
    }

    let categoryPath: string | undefined;
    if (input.categoryId) {
      const [c] = await db
        .select({ path: assetCategories.path })
        .from(assetCategories)
        .where(eq(assetCategories.id, input.categoryId))
        .limit(1);
      if (!c) throw errors.notFound('Category');
      categoryPath = c.path;
    }

    const { aiSummary, aiMetadata, searchText } = composeAssetAiFields({
      nameEn: input.nameEn,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      kind: input.kind,
      status: input.status,
      criticality: input.criticality,
      categoryPath,
      areaKind,
      branchCity: branch.city,
      spec: input.spec,
    });

    const [created] = await db
      .insert(assets)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        purchaseCost: input.purchaseCost != null ? String(input.purchaseCost) : null,
        aiSummary,
        aiMetadata,
        searchText,
      })
      .returning();

    // Mint the first QR
    const token = await generateUniqueQrToken();
    await db.insert(assetQrCodes).values({
      companyId: req.tenant.companyId,
      assetId: created.id,
      token,
      isActive: true,
    });

    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: created.id,
      eventType: 'created',
      actorUserId: req.tenant.userId,
      after: { code: created.code, nameEn: created.nameEn, status: created.status },
    });
    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: created.id,
      eventType: 'qr_generated',
      actorUserId: req.tenant.userId,
      after: { token },
    });

    res.status(201).json(ok({ ...created, activeQr: { token, scanUrl: `${env.QR_SCAN_BASE_URL}/${token}` } }));
  } catch (err) {
    next(err);
  }
});

const patchSchema = createSchema.partial();

assetsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);

    const [before] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.companyId, req.tenant.companyId), isNull(assets.deletedAt)))
      .limit(1);
    if (!before) throw errors.notFound('Asset');

    const [updated] = await db
      .update(assets)
      .set({
        ...patch,
        purchaseCost: patch.purchaseCost != null ? String(patch.purchaseCost) : patch.purchaseCost,
        updatedAt: sql`now()`,
      })
      .where(eq(assets.id, id))
      .returning();

    const delta = shallowDiff(
      before as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    // Emit typed events for high-value fields
    if ('status' in delta) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'status_changed',
        actorUserId: req.tenant.userId,
        before: { status: before.status },
        after: { status: updated.status },
      });
    }
    if ('branchId' in delta || 'areaId' in delta) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'moved',
        actorUserId: req.tenant.userId,
        before: { branchId: before.branchId, areaId: before.areaId },
        after: { branchId: updated.branchId, areaId: updated.areaId },
      });
    }
    if ('categoryId' in delta) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'category_changed',
        actorUserId: req.tenant.userId,
        before: { categoryId: before.categoryId },
        after: { categoryId: updated.categoryId },
      });
    }
    if ('supplierId' in delta) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'supplier_assigned',
        actorUserId: req.tenant.userId,
        before: { supplierId: before.supplierId },
        after: { supplierId: updated.supplierId },
      });
    }
    if ('spec' in delta) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'spec_updated',
        actorUserId: req.tenant.userId,
        before: { spec: before.spec },
        after: { spec: updated.spec },
      });
    }
    // Catch-all generic "updated" for any remaining fields
    const remaining = Object.keys(delta).filter(
      (k) => !['status', 'branchId', 'areaId', 'categoryId', 'supplierId', 'spec', 'updatedAt', 'aiSummary', 'aiMetadata', 'searchText'].includes(k),
    );
    if (remaining.length > 0) {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'updated',
        actorUserId: req.tenant.userId,
        delta: Object.fromEntries(remaining.map((k) => [k, delta[k]])),
      });
    }

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// DECOMMISSION — soft-delete-adjacent; keeps the row for history, sets status
const decommissionSchema = z.object({ reason: z.string().min(1).max(500) });

assetsRouter.post('/:id/decommission', requireRole(...decommissionRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const { reason } = decommissionSchema.parse(req.body);

    const [updated] = await db
      .update(assets)
      .set({
        status: 'decommissioned',
        decommissionedAt: sql`now()`,
        decommissionReason: reason,
        updatedAt: sql`now()`,
      })
      .where(and(eq(assets.id, id), eq(assets.companyId, req.tenant.companyId), isNull(assets.deletedAt)))
      .returning();
    if (!updated) throw errors.notFound('Asset');

    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: id,
      eventType: 'decommissioned',
      actorUserId: req.tenant.userId,
      note: reason,
    });

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// EVENTS — read the immutable log
assetsRouter.get('/:id/events', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(assetEvents)
      .where(and(eq(assetEvents.assetId, id), eq(assetEvents.companyId, req.tenant.companyId)))
      .orderBy(desc(assetEvents.createdAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

// TAGS — add / remove
assetsRouter.post('/:id/tags', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const { tagIds } = z.object({ tagIds: z.array(z.string().uuid()).min(1) }).parse(req.body);

    const validTags = await db
      .select({ id: assetTags.id })
      .from(assetTags)
      .where(and(eq(assetTags.companyId, req.tenant.companyId), inArray(assetTags.id, tagIds)));
    if (validTags.length !== tagIds.length) {
      throw errors.badRequest({ ar: 'وسم أو أكثر غير موجود', en: 'One or more tags not found' });
    }

    for (const tagId of tagIds) {
      await db
        .insert(assetTagAssignments)
        .values({ companyId: req.tenant.companyId, assetId: id, tagId })
        .onConflictDoNothing();
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: id,
        eventType: 'tagged',
        actorUserId: req.tenant.userId,
        after: { tagId },
      });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

assetsRouter.delete('/:id/tags/:tagId', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const tagId = z.string().uuid().parse(req.params.tagId);
    await db
      .delete(assetTagAssignments)
      .where(
        and(
          eq(assetTagAssignments.assetId, id),
          eq(assetTagAssignments.tagId, tagId),
          eq(assetTagAssignments.companyId, req.tenant.companyId),
        ),
      );
    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: id,
      eventType: 'untagged',
      actorUserId: req.tenant.userId,
      before: { tagId },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// WARRANTIES — nested CRUD
const warrantySchema = z.object({
  providerSupplierId: z.string().uuid().nullable().optional(),
  type: z.enum(['manufacturer', 'extended', 'service_contract', 'insurance', 'other']).default('manufacturer'),
  referenceNumber: z.string().max(128).nullable().optional(),
  coverageSummary: z.string().nullable().optional(),
  exclusions: z.string().nullable().optional(),
  termsText: z.string().nullable().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('SAR'),
  coverageLimit: z.number().nonnegative().nullable().optional(),
  autoRenew: z.boolean().default(false),
});

assetsRouter.get('/:id/warranties', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(warranties)
      .where(and(eq(warranties.assetId, id), eq(warranties.companyId, req.tenant.companyId)));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

assetsRouter.post('/:id/warranties', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const input = warrantySchema.parse(req.body);
    const [created] = await db
      .insert(warranties)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        assetId: id,
        cost: input.cost != null ? String(input.cost) : null,
        coverageLimit: input.coverageLimit != null ? String(input.coverageLimit) : null,
      })
      .returning();
    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: id,
      eventType: 'warranty_added',
      actorUserId: req.tenant.userId,
      after: { warrantyId: created.id, endsOn: input.endsOn },
    });
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// MAINTENANCE SCHEDULES — nested
const scheduleSchema = z.object({
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  kind: z.enum(['preventive','corrective','predictive','inspection','calibration','sanitation','safety_check','other']).default('preventive'),
  frequency: z.enum(['daily','weekly','biweekly','monthly','bimonthly','quarterly','semi_annually','annually','usage_based','condition_based','custom']).default('monthly'),
  rrule: z.string().nullable().optional(),
  intervalCount: z.number().int().min(1).default(1),
  riskIfSkipped: riskLevel.default('medium'),
  startsOn: z.string().datetime(),
  endsOn: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  requiresShutdown: z.boolean().default(false),
  playbook: z.record(z.unknown()).optional(),
});

assetsRouter.get('/:id/maintenance-schedules', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.assetId, id), eq(maintenanceSchedules.companyId, req.tenant.companyId)));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

assetsRouter.post('/:id/maintenance-schedules', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const input = scheduleSchema.parse(req.body);
    const [created] = await db
      .insert(maintenanceSchedules)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        assetId: id,
        startsOn: new Date(input.startsOn),
        endsOn: input.endsOn ? new Date(input.endsOn) : null,
        nextDueAt: new Date(input.startsOn),
      })
      .returning();
    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: id,
      eventType: 'maintenance_scheduled',
      actorUserId: req.tenant.userId,
      after: { scheduleId: created.id, frequency: input.frequency, nextDueAt: created.nextDueAt },
    });
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// QR — reprint (mints new active token, revokes old)
assetsRouter.post('/:id/qr/reprint', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);

    const [asset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.companyId, req.tenant.companyId), isNull(assets.deletedAt)))
      .limit(1);
    if (!asset) throw errors.notFound('Asset');

    await db
      .update(assetQrCodes)
      .set({ isActive: false, revokedAt: sql`now()` })
      .where(and(eq(assetQrCodes.assetId, id), eq(assetQrCodes.isActive, true)));

    const token = await generateUniqueQrToken();
    const [created] = await db
      .insert(assetQrCodes)
      .values({ companyId: req.tenant.companyId, assetId: id, token, isActive: true, printedAt: sql`now()`, printedByUserId: req.tenant.userId })
      .returning();

    await emitAssetEvent({
      companyId: req.tenant.companyId,
      assetId: id,
      eventType: 'qr_reprinted',
      actorUserId: req.tenant.userId,
      after: { token },
    });

    res.status(201).json(ok({ ...created, scanUrl: `${env.QR_SCAN_BASE_URL}/${token}` }));
  } catch (err) {
    next(err);
  }
});
