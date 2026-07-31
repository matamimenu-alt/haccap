import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, suppliers, supplierContacts } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const suppliersRouter: Router = Router();
suppliersRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

suppliersRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(suppliers)
      .where(scoped(suppliers.companyId, req.tenant.companyId, suppliers.deletedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

suppliersRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, req.tenant.companyId), isNull(suppliers.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Supplier');
    const contacts = await db
      .select()
      .from(supplierContacts)
      .where(and(eq(supplierContacts.supplierId, id), eq(supplierContacts.companyId, req.tenant.companyId)));
    res.json(ok({ ...row, contacts }));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  code: z.string().max(32).nullable().optional(),
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  legalName: z.string().max(255).nullable().optional(),
  commercialRegistration: z.string().max(50).nullable().optional(),
  vatNumber: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  website: z.string().url().nullable().optional(),
  country: z.string().length(2).default('SA'),
  city: z.string().max(128).nullable().optional(),
  addressLine: z.string().nullable().optional(),
  categories: z.array(z.string()).default([]),
  approvals: z.record(z.object({
    certifiedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    ref: z.string().optional(),
  })).optional(),
  isPreferred: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

suppliersRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);
    const aiSummary = `${input.nameEn} · ${input.categories.join(', ') || 'general'}`;
    const [created] = await db
      .insert(suppliers)
      .values({ ...input, companyId: req.tenant.companyId, aiSummary })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

suppliersRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = createSchema.partial().parse(req.body);
    const [updated] = await db
      .update(suppliers)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, req.tenant.companyId), isNull(suppliers.deletedAt)))
      .returning();
    if (!updated) throw errors.notFound('Supplier');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

suppliersRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [deleted] = await db
      .update(suppliers)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, req.tenant.companyId), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    if (!deleted) throw errors.notFound('Supplier');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Contacts
const contactSchema = z.object({
  fullName: z.string().min(1).max(255),
  title: z.string().max(128).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

suppliersRouter.post('/:id/contacts', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const supplierId = z.string().uuid().parse(req.params.id);
    const input = contactSchema.parse(req.body);
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, req.tenant.companyId)))
      .limit(1);
    if (!supplier) throw errors.notFound('Supplier');
    const [created] = await db
      .insert(supplierContacts)
      .values({ ...input, companyId: req.tenant.companyId, supplierId })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

suppliersRouter.delete('/:id/contacts/:contactId', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const contactId = z.string().uuid().parse(req.params.contactId);
    const [deleted] = await db
      .delete(supplierContacts)
      .where(and(eq(supplierContacts.id, contactId), eq(supplierContacts.companyId, req.tenant.companyId)))
      .returning({ id: supplierContacts.id });
    if (!deleted) throw errors.notFound('Contact');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
