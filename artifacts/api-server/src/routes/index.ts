import { Router } from 'express';
import { authRouter } from './auth.js';
import { companiesRouter } from './companies.js';
import { brandsRouter } from './brands.js';
import { branchesRouter } from './branches.js';
import { usersRouter } from './users.js';
import { rolesRouter } from './roles.js';
import { departmentsRouter } from './departments.js';
import { orgLevelsRouter } from './org-levels.js';
// Phase 2 — Operations Core
import { areasRouter } from './areas.js';
import { assetCategoriesRouter } from './asset-categories.js';
import { suppliersRouter } from './suppliers.js';
import { assetsRouter } from './assets.js';
import { assetTagsRouter } from './asset-tags.js';
import { attachmentsRouter } from './attachments.js';
import { maintenanceSchedulesRouter } from './maintenance-schedules.js';
import { qrRouter } from './qr.js';

export const v1Router: Router = Router();

v1Router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } });
});

// Phase 1 — Foundation
v1Router.use('/auth', authRouter);
v1Router.use('/companies', companiesRouter);
v1Router.use('/brands', brandsRouter);
v1Router.use('/branches', branchesRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/departments', departmentsRouter);
v1Router.use('/org-levels', orgLevelsRouter);

// Phase 2 — Operations Core
v1Router.use('/areas', areasRouter);
v1Router.use('/asset-categories', assetCategoriesRouter);
v1Router.use('/suppliers', suppliersRouter);
v1Router.use('/assets', assetsRouter);
v1Router.use('/asset-tags', assetTagsRouter);
v1Router.use('/attachments', attachmentsRouter);
v1Router.use('/maintenance-schedules', maintenanceSchedulesRouter);
v1Router.use('/qr', qrRouter);
