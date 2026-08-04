import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, findings } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';

export const findingsRouter: Router = Router();
findingsRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'area_manager', 'branch_manager', 'food_safety_officer', 'internal_auditor'];

findingsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z
      .object({
        branchId: z.string().uuid().optional(),
        status: z.enum(['open', 'in_capa', 'resolved', 'accepted_risk', 'closed', 'reopened']).optional(),
        severity: z.enum(['observation', 'minor', 'major', 'critical']).optional(),
      })
      .parse(req.query);
    const filters = [eq(findings.companyId, req.tenant.companyId)];
    if (q.branchId) filters.push(eq(findings.branchId, q.branchId));
    if (q.status)   filters.push(eq(findings.status, q.status));
    if (q.severity) filters.push(eq(findings.severity, q.severity));
    const rows = await db.select().from(findings).where(and(...filters)).orderBy(desc(findings.createdAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  status: z.enum(['open', 'in_capa', 'resolved', 'accepted_risk', 'closed', 'reopened']).optional(),
  severity: z.enum(['observation', 'minor', 'major', 'critical']).optional(),
  correctiveAction: z.string().nullable().optional(),
  preventiveAction: z.string().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

findingsRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    const setBag: Record<string, unknown> = {
      ...patch,
      dueAt: patch.dueAt !== undefined ? (patch.dueAt ? new Date(patch.dueAt) : null) : undefined,
      updatedAt: sql`now()`,
    };
    if (patch.status && ['resolved', 'closed'].includes(patch.status)) {
      setBag.resolvedAt = new Date();
      setBag.resolvedByUserId = req.tenant.userId;
    }
    const [updated] = await db
      .update(findings)
      .set(setBag)
      .where(and(eq(findings.id, id), eq(findings.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Finding');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// Suppress unused
void scoped;
