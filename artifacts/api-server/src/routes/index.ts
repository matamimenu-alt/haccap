import { Router } from 'express';
import { authRouter } from './auth.js';
import { companiesRouter } from './companies.js';
import { brandsRouter } from './brands.js';
import { branchesRouter } from './branches.js';
import { usersRouter } from './users.js';
import { rolesRouter } from './roles.js';
import { departmentsRouter } from './departments.js';
import { orgLevelsRouter } from './org-levels.js';

export const v1Router: Router = Router();

v1Router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } });
});

v1Router.use('/auth', authRouter);
v1Router.use('/companies', companiesRouter);
v1Router.use('/brands', brandsRouter);
v1Router.use('/branches', branchesRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/departments', departmentsRouter);
v1Router.use('/org-levels', orgLevelsRouter);
