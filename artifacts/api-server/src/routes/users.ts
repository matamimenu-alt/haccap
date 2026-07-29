import { Router } from 'express';
import argon2 from 'argon2';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, users, roles as rolesTable, userRoles } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const usersRouter: Router = Router();
usersRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

usersRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullNameAr: users.fullNameAr,
        fullNameEn: users.fullNameEn,
        preferredLocale: users.preferredLocale,
        status: users.status,
        branchIds: users.branchIds,
        departmentId: users.departmentId,
        avatarUrl: users.avatarUrl,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(scoped(users.companyId, req.tenant.companyId, users.deletedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullNameAr: z.string().min(1).max(255),
  fullNameEn: z.string().min(1).max(255),
  phone: z.string().max(32).nullable().optional(),
  preferredLocale: z.enum(['ar', 'en']).default('ar'),
  branchIds: z.array(z.string().uuid()).default([]),
  departmentId: z.string().uuid().nullable().optional(),
  roleKeys: z.array(z.string()).min(1),
});

usersRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, req.tenant.companyId), eq(users.email, email)))
      .limit(1);
    if (existing) {
      throw errors.conflict({ ar: 'البريد الإلكتروني مستخدم بالفعل', en: 'Email already in use' });
    }

    const targetRoles = await db
      .select({ id: rolesTable.id, key: rolesTable.key })
      .from(rolesTable)
      .where(inArray(rolesTable.key, input.roleKeys));
    if (targetRoles.length !== input.roleKeys.length) {
      throw errors.badRequest({
        ar: 'دور واحد أو أكثر غير موجود',
        en: 'One or more roles not found',
      });
    }

    const passwordHash = await argon2.hash(input.password);
    const [created] = await db
      .insert(users)
      .values({
        companyId: req.tenant.companyId,
        email,
        phone: input.phone ?? null,
        passwordHash,
        fullNameAr: input.fullNameAr,
        fullNameEn: input.fullNameEn,
        preferredLocale: input.preferredLocale,
        branchIds: input.branchIds,
        departmentId: input.departmentId ?? null,
      })
      .returning();

    await db.insert(userRoles).values(
      targetRoles.map((r) => ({
        companyId: req.tenant!.companyId,
        userId: created.id,
        roleId: r.id,
      })),
    );

    const { passwordHash: _pw, ...safe } = created;
    res.status(201).json(ok(safe));
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  fullNameAr: z.string().min(1).max(255).optional(),
  fullNameEn: z.string().min(1).max(255).optional(),
  phone: z.string().max(32).nullable().optional(),
  preferredLocale: z.enum(['ar', 'en']).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'invited', 'suspended', 'deactivated']).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

usersRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const [updated] = await db
      .update(users)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(users.id, id), eq(users.companyId, req.tenant.companyId), isNull(users.deletedAt)))
      .returning();
    if (!updated) throw errors.notFound('User');
    const { passwordHash: _pw, ...safe } = updated;
    res.json(ok(safe));
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    if (id === req.tenant.userId) {
      throw errors.badRequest({ ar: 'لا يمكنك حذف حسابك', en: 'You cannot delete your own account' });
    }
    const [deleted] = await db
      .update(users)
      .set({ deletedAt: sql`now()`, status: 'deactivated' })
      .where(and(eq(users.id, id), eq(users.companyId, req.tenant.companyId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!deleted) throw errors.notFound('User');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
