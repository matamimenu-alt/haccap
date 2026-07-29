import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, companies } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth } from '../middleware/auth.js';

export const companiesRouter: Router = Router();
companiesRouter.use(requireAuth);

// Phase 1 exposes a single "my company" endpoint — tenant is derived from JWT.
companiesRouter.get('/me', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, req.tenant.companyId), isNull(companies.deletedAt)))
      .limit(1);
    if (!company) throw errors.notFound('Company');
    res.json(ok(company));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  nameAr: z.string().min(1).max(255).optional(),
  nameEn: z.string().min(1).max(255).optional(),
  commercialRegistration: z.string().max(50).nullable().optional(),
  vatNumber: z.string().max(50).nullable().optional(),
  defaultLocale: z.enum(['ar', 'en']).optional(),
  timezone: z.string().max(64).optional(),
  logoUrl: z.string().url().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

companiesRouter.patch('/me', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    if (!req.tenant.roles.includes('company_owner') && !req.tenant.roles.includes('platform_super_admin')) {
      throw errors.forbidden();
    }
    const patch = updateSchema.parse(req.body);
    const [updated] = await db
      .update(companies)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(companies.id, req.tenant.companyId))
      .returning();
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});
