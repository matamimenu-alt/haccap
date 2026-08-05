import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  batchMovements,
  batches,
  calibrationRecords,
  cleaningRecords,
  employeeCertifications,
  pestControlRecords,
  receivingLogs,
  temperatureLogs,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const foodSafetyRouter: Router = Router();
foodSafetyRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'branch_manager', 'food_safety_officer', 'supervisor', 'employee'];
const managerRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'branch_manager', 'food_safety_officer', 'internal_auditor'];

/* ------------------------- TEMPERATURE LOGS ------------------------- */

const tempSchema = z.object({
  branchId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  kind: z.string().max(32).default('spot'),
  valueC: z.number(),
  targetMinC: z.number().nullable().optional(),
  targetMaxC: z.number().nullable().optional(),
  observedAt: z.string().datetime().optional(),
  probeAssetId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/temperature-logs', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z.object({ branchId: z.string().uuid().optional(), assetId: z.string().uuid().optional() }).parse(req.query);
    const filters = [eq(temperatureLogs.companyId, req.tenant.companyId)];
    if (q.branchId) filters.push(eq(temperatureLogs.branchId, q.branchId));
    if (q.assetId) filters.push(eq(temperatureLogs.assetId, q.assetId));
    const rows = await db.select().from(temperatureLogs).where(and(...filters)).orderBy(desc(temperatureLogs.observedAt)).limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/temperature-logs', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = tempSchema.parse(req.body);
    const inRange = (input.targetMinC == null || input.valueC >= input.targetMinC) &&
                    (input.targetMaxC == null || input.valueC <= input.targetMaxC);
    const [created] = await db
      .insert(temperatureLogs)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        areaId: input.areaId ?? null,
        assetId: input.assetId ?? null,
        kind: input.kind,
        valueC: String(input.valueC),
        targetMinC: input.targetMinC != null ? String(input.targetMinC) : null,
        targetMaxC: input.targetMaxC != null ? String(input.targetMaxC) : null,
        isInRange: inRange,
        probeAssetId: input.probeAssetId ?? null,
        observedByUserId: req.tenant.userId,
        observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- RECEIVING ------------------------- */

const receivingSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  reference: z.string().max(64).nullable().optional(),
  invoiceNumber: z.string().max(64).nullable().optional(),
  driverName: z.string().max(128).nullable().optional(),
  vehiclePlate: z.string().max(32).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  vehicleTempC: z.number().nullable().optional(),
  productTempC: z.number().nullable().optional(),
  items: z.array(z.object({
    nameEn: z.string(),
    nameAr: z.string().optional(),
    quantity: z.number(),
    unit: z.string(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    temperatureC: z.number().optional(),
    accepted: z.boolean(),
    rejectReason: z.string().optional(),
  })).default([]),
  result: z.enum(['accepted', 'partially_accepted', 'rejected', 'quarantine']).default('accepted'),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/receiving', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(receivingLogs)
      .where(scoped(receivingLogs.companyId, req.tenant.companyId))
      .orderBy(desc(receivingLogs.receivedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/receiving', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = receivingSchema.parse(req.body);
    const [created] = await db
      .insert(receivingLogs)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        supplierId: input.supplierId ?? null,
        reference: input.reference ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        driverName: input.driverName ?? null,
        vehiclePlate: input.vehiclePlate ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        receivedByUserId: req.tenant.userId,
        vehicleTempC: input.vehicleTempC != null ? String(input.vehicleTempC) : null,
        productTempC: input.productTempC != null ? String(input.productTempC) : null,
        items: input.items,
        result: input.result,
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- CLEANING ------------------------- */

const cleaningSchema = z.object({
  branchId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  frequency: z.string().max(32).default('daily'),
  scopeDescription: z.string().nullable().optional(),
  performedAt: z.string().datetime().optional(),
  chemicals: z.array(z.object({ name: z.string(), concentration: z.string().optional(), contactMinutes: z.number().optional() })).default([]),
  method: z.string().max(64).nullable().optional(),
  atpSwabRlu: z.string().max(16).nullable().optional(),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/cleaning', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(cleaningRecords)
      .where(scoped(cleaningRecords.companyId, req.tenant.companyId))
      .orderBy(desc(cleaningRecords.performedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/cleaning', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = cleaningSchema.parse(req.body);
    const [created] = await db
      .insert(cleaningRecords)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        areaId: input.areaId ?? null,
        frequency: input.frequency,
        scopeDescription: input.scopeDescription ?? null,
        performedByUserId: req.tenant.userId,
        performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
        chemicals: input.chemicals,
        method: input.method ?? null,
        atpSwabRlu: input.atpSwabRlu ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- PEST CONTROL ------------------------- */

const pestSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  reference: z.string().max(64).nullable().optional(),
  visitedAt: z.string().datetime().optional(),
  technicianName: z.string().max(128).nullable().optional(),
  result: z.enum(['clear', 'evidence_found', 'infestation', 'treatment_applied']).default('clear'),
  findings: z.array(z.object({ location: z.string(), pest: z.string().optional(), severity: z.string().optional(), note: z.string().optional() })).default([]),
  treatmentsApplied: z.array(z.object({ chemical: z.string().optional(), method: z.string(), location: z.string().optional(), safetyPeriodHours: z.number().optional() })).default([]),
  recommendations: z.string().nullable().optional(),
  nextVisitDueOn: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/pest-control', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(pestControlRecords)
      .where(scoped(pestControlRecords.companyId, req.tenant.companyId))
      .orderBy(desc(pestControlRecords.visitedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/pest-control', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = pestSchema.parse(req.body);
    const [created] = await db
      .insert(pestControlRecords)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        supplierId: input.supplierId ?? null,
        reference: input.reference ?? null,
        visitedAt: input.visitedAt ? new Date(input.visitedAt) : new Date(),
        technicianName: input.technicianName ?? null,
        result: input.result,
        findings: input.findings,
        treatmentsApplied: input.treatmentsApplied,
        recommendations: input.recommendations ?? null,
        nextVisitDueOn: input.nextVisitDueOn ? new Date(input.nextVisitDueOn) : null,
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- CALIBRATION ------------------------- */

const calibrationSchema = z.object({
  assetId: z.string().uuid(),
  reference: z.string().max(64).nullable().optional(),
  method: z.string().max(64).default('ice_point'),
  performedAt: z.string().datetime().optional(),
  expectedValue: z.number().optional(),
  measuredValue: z.number().optional(),
  tolerance: z.number().optional(),
  unit: z.string().max(16).default('°C'),
  isPass: z.boolean(),
  adjustmentMade: z.boolean().default(false),
  nextDueOn: z.string().datetime().nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/calibrations', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(calibrationRecords)
      .where(scoped(calibrationRecords.companyId, req.tenant.companyId))
      .orderBy(desc(calibrationRecords.performedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/calibrations', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = calibrationSchema.parse(req.body);
    const [created] = await db
      .insert(calibrationRecords)
      .values({
        companyId: req.tenant.companyId,
        assetId: input.assetId,
        reference: input.reference ?? null,
        method: input.method,
        performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
        performedByUserId: req.tenant.userId,
        expectedValue: input.expectedValue != null ? String(input.expectedValue) : null,
        measuredValue: input.measuredValue != null ? String(input.measuredValue) : null,
        tolerance: input.tolerance != null ? String(input.tolerance) : null,
        unit: input.unit,
        isPass: input.isPass,
        adjustmentMade: input.adjustmentMade,
        nextDueOn: input.nextDueOn ? new Date(input.nextDueOn) : null,
        certificateUrl: input.certificateUrl ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- CERTIFICATIONS ------------------------- */

const certSchema = z.object({
  userId: z.string().uuid(),
  kind: z.string().min(1).max(64),
  titleEn: z.string().min(1).max(255),
  titleAr: z.string().min(1).max(255),
  issuingAuthority: z.string().max(128).nullable().optional(),
  referenceNumber: z.string().max(128).nullable().optional(),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

foodSafetyRouter.get('/certifications', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z.object({ userId: z.string().uuid().optional() }).parse(req.query);
    const filters = [eq(employeeCertifications.companyId, req.tenant.companyId)];
    if (q.userId) filters.push(eq(employeeCertifications.userId, q.userId));
    const rows = await db.select().from(employeeCertifications).where(and(...filters)).orderBy(desc(employeeCertifications.updatedAt)).limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/certifications', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = certSchema.parse(req.body);
    // Compute status from expiry
    const now = new Date();
    let status: 'active' | 'expiring_soon' | 'expired' = 'active';
    if (input.expiresOn) {
      const exp = new Date(input.expiresOn);
      const daysLeft = Math.floor((exp.getTime() - now.getTime()) / 86400_000);
      if (daysLeft < 0) status = 'expired';
      else if (daysLeft <= 30) status = 'expiring_soon';
    }
    const [created] = await db
      .insert(employeeCertifications)
      .values({ ...input, companyId: req.tenant.companyId, status })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ------------------------- BATCHES / TRACEABILITY ------------------------- */

const batchSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  receivingLogId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(64),
  productNameEn: z.string().min(1).max(255),
  productNameAr: z.string().max(255).nullable().optional(),
  supplierBatchNumber: z.string().max(128).nullable().optional(),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  initialQuantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(16).nullable().optional(),
  storageLocation: z.string().max(128).nullable().optional(),
  allergenTags: z.array(z.string()).default([]),
});

foodSafetyRouter.get('/batches', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db.select().from(batches).where(scoped(batches.companyId, req.tenant.companyId)).orderBy(desc(batches.createdAt)).limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.post('/batches', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = batchSchema.parse(req.body);
    const [created] = await db
      .insert(batches)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        initialQuantity: input.initialQuantity != null ? String(input.initialQuantity) : null,
        currentQuantity: input.initialQuantity != null ? String(input.initialQuantity) : null,
      })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

foodSafetyRouter.get('/batches/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [batch] = await db.select().from(batches).where(and(eq(batches.id, id), eq(batches.companyId, req.tenant.companyId))).limit(1);
    if (!batch) throw errors.notFound('Batch');
    const movements = await db.select().from(batchMovements).where(eq(batchMovements.batchId, id)).orderBy(desc(batchMovements.performedAt));
    res.json(ok({ ...batch, movements }));
  } catch (err) {
    next(err);
  }
});

const movementSchema = z.object({
  kind: z.enum(['transferred', 'used_in_prep', 'cooked', 'discarded', 'returned']),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(16).nullable().optional(),
  note: z.string().nullable().optional(),
  downstreamRef: z.string().max(128).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  performedAt: z.string().datetime().optional(),
});

foodSafetyRouter.post('/batches/:id/movements', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const input = movementSchema.parse(req.body);
    const [created] = await db
      .insert(batchMovements)
      .values({
        companyId: req.tenant.companyId,
        batchId: id,
        branchId: input.branchId ?? null,
        kind: input.kind,
        quantity: input.quantity != null ? String(input.quantity) : null,
        unit: input.unit ?? null,
        note: input.note ?? null,
        downstreamRef: input.downstreamRef ?? null,
        performedByUserId: req.tenant.userId,
        performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      })
      .returning();
    // Auto-decrement currentQuantity when consumed
    if (input.quantity != null && ['used_in_prep', 'cooked', 'discarded'].includes(input.kind)) {
      await db.execute(sql`UPDATE batches SET current_quantity = GREATEST(0, coalesce(current_quantity, 0) - ${input.quantity}), updated_at = now() WHERE id = ${id}`);
    }
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// Recall — mark batch and all downstream movements as recalled
foodSafetyRouter.post('/batches/:id/recall', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const body = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
    const [updated] = await db
      .update(batches)
      .set({ isRecalled: true, recalledAt: new Date(), recallReason: body.reason, status: 'recalled', updatedAt: sql`now()` })
      .where(and(eq(batches.id, id), eq(batches.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Batch');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});
