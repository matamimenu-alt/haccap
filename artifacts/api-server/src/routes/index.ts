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
// Phase 3 — Task Engine
import { taskTemplatesRouter } from './task-templates.js';
import { tasksRouter } from './tasks.js';
import { jobsRouter } from './jobs.js';
// Phase 4 — Inspection Engine
import { inspectionTemplatesRouter } from './inspection-templates.js';
import { inspectionsRouter } from './inspections.js';
import { findingsRouter } from './findings.js';
// Phase 5 — Knowledge Engine
import { knowledgeRouter } from './knowledge.js';
// Phase 6 — HACCP + Food Safety
import { haccpRouter } from './haccp.js';
import { foodSafetyRouter } from './food-safety.js';

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

// Phase 3 — Task Engine
v1Router.use('/task-templates', taskTemplatesRouter);
v1Router.use('/tasks', tasksRouter);
v1Router.use('/jobs', jobsRouter);

// Phase 4 — Inspection Engine
v1Router.use('/inspection-templates', inspectionTemplatesRouter);
v1Router.use('/inspections', inspectionsRouter);
v1Router.use('/findings', findingsRouter);

// Phase 5 — Knowledge Engine
v1Router.use('/knowledge', knowledgeRouter);

// Phase 6 — HACCP + Food Safety
v1Router.use('/haccp', haccpRouter);
v1Router.use('/food-safety', foodSafetyRouter);
