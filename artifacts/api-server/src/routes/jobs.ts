import { Router } from 'express';
import { z } from 'zod';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { materializeFromSchedule, runMaterializationTick } from '../services/task-materializer.js';

export const jobsRouter: Router = Router();
jobsRouter.use(requireAuth);

const adminRoles = ['platform_super_admin', 'company_owner', 'operations_director'];

// Force a materialization tick — useful for tests, demos, and Phase 8 pull.
jobsRouter.post('/materialize', requireRole(...adminRoles), async (req, res, next) => {
  try {
    const q = z.object({ horizonHours: z.coerce.number().int().positive().max(720).default(24) }).parse(req.query);
    const result = await runMaterializationTick(q.horizonHours);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

// Materialize a single schedule now (for debug + admin actions).
jobsRouter.post('/materialize/:scheduleId', requireRole(...adminRoles), async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.scheduleId);
    const result = await materializeFromSchedule(id);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
