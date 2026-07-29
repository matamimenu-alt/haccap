import { Router } from 'express';
import { eq, isNull, or } from 'drizzle-orm';
import { db, roles as rolesTable, permissions, rolePermissions } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth } from '../middleware/auth.js';

export const rolesRouter: Router = Router();
rolesRouter.use(requireAuth);

// List system roles + this company's custom roles.
rolesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(rolesTable)
      .where(or(isNull(rolesTable.companyId), eq(rolesTable.companyId, req.tenant.companyId)));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

rolesRouter.get('/permissions', async (_req, res, next) => {
  try {
    const rows = await db.select().from(permissions);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

rolesRouter.get('/:id/permissions', async (req, res, next) => {
  try {
    const roleId = req.params.id;
    const rows = await db
      .select({
        id: permissions.id,
        key: permissions.key,
        module: permissions.module,
        action: permissions.action,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});
