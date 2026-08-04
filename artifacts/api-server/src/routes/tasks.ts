import { Router } from 'express';
import { and, count, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  areas,
  branches,
  tasks,
  taskAssignments,
  taskComments,
  taskDependencies,
  taskEvents,
  taskTemplates,
  taskTimeEntries,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoped } from '../middleware/tenant-scope.js';
import { composeTaskAiFields, emitTaskEvent } from '../services/task-events.js';

export const tasksRouter: Router = Router();
tasksRouter.use(requireAuth);

const writeRoles = [
  'platform_super_admin', 'company_owner', 'operations_director',
  'area_manager', 'branch_manager', 'food_safety_officer', 'supervisor',
];
const verifyRoles = [
  'platform_super_admin', 'company_owner', 'operations_director',
  'area_manager', 'branch_manager', 'food_safety_officer', 'internal_auditor',
];

const polymorphicTarget = z.enum([
  'asset', 'area', 'branch', 'brand', 'company', 'supplier',
  'warranty', 'maintenance_schedule', 'inspection', 'task', 'incident',
]);
const status = z.enum(['draft', 'open', 'scheduled', 'in_progress', 'blocked', 'in_review', 'completed', 'verified', 'cancelled']);
const priority = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const kind = z.enum([
  'maintenance','inspection_followup','capa_action','incident_response','compliance',
  'sanitation','training','safety_check','calibration','ad_hoc','other',
]);
const risk = z.enum(['none', 'low', 'medium', 'high', 'critical']);
const source = z.enum(['manual', 'maintenance_schedule', 'inspection', 'ccp_deviation', 'incident', 'system', 'ai']);

// -------- LIST + FILTERS --------
const listQuery = z.object({
  branchId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  targetType: polymorphicTarget.optional(),
  targetId: z.string().uuid().optional(),
  status: z.union([status, z.array(status)]).optional(),
  priority: z.union([priority, z.array(priority)]).optional(),
  kind: z.union([kind, z.array(kind)]).optional(),
  source: source.optional(),
  assignedToMe: z.coerce.boolean().optional(),
  dueBefore: z.string().datetime().optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

tasksRouter.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const query = req.query;
    // Coerce array-shaped query params (status=open&status=blocked)
    const normalize = <T>(v: unknown): T[] | undefined => {
      if (v == null) return undefined;
      return Array.isArray(v) ? (v as T[]) : ([v] as T[]);
    };
    const q = listQuery.parse({
      ...query,
      status: normalize(query.status),
      priority: normalize(query.priority),
      kind: normalize(query.kind),
    });

    const filters = [eq(tasks.companyId, req.tenant.companyId), isNull(tasks.deletedAt)];
    if (q.branchId)   filters.push(eq(tasks.branchId, q.branchId));
    if (q.areaId)     filters.push(eq(tasks.areaId, q.areaId));
    if (q.targetType) filters.push(eq(tasks.targetType, q.targetType));
    if (q.targetId)   filters.push(eq(tasks.targetId, q.targetId));
    if (q.source)     filters.push(eq(tasks.source, q.source));
    if (q.status)     filters.push(Array.isArray(q.status) ? inArray(tasks.status, q.status) : eq(tasks.status, q.status));
    if (q.priority)   filters.push(Array.isArray(q.priority) ? inArray(tasks.priority, q.priority) : eq(tasks.priority, q.priority));
    if (q.kind)       filters.push(Array.isArray(q.kind) ? inArray(tasks.kind, q.kind) : eq(tasks.kind, q.kind));
    if (q.assignedToMe) filters.push(eq(tasks.primaryAssigneeUserId, req.tenant.userId));
    if (q.dueBefore)  filters.push(lt(tasks.dueAt, new Date(q.dueBefore)));
    if (q.overdue) {
      filters.push(lt(tasks.dueAt, new Date()));
      filters.push(inArray(tasks.status, ['open', 'scheduled', 'in_progress', 'blocked']));
    }
    if (q.q) {
      const term = q.q.toLowerCase();
      filters.push(or(
        sql`LOWER(${tasks.titleEn}) LIKE ${'%' + term + '%'}`,
        sql`LOWER(${tasks.titleAr}) LIKE ${'%' + term + '%'}`,
      )!);
    }

    const where = and(...filters);
    const [{ value: total }] = await db.select({ value: count() }).from(tasks).where(where);
    const rows = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.priority), desc(tasks.dueAt), desc(tasks.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    res.json(
      ok(rows, {
        page: q.page,
        pageSize: q.pageSize,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / q.pageSize),
      }),
    );
  } catch (err) {
    next(err);
  }
});

// -------- SUMMARY (dashboard aggregate) --------
tasksRouter.get('/summary', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const now = new Date();
    const rows = await db
      .select({ status: tasks.status, priority: tasks.priority, count: count() })
      .from(tasks)
      .where(scoped(tasks.companyId, req.tenant.companyId, tasks.deletedAt))
      .groupBy(tasks.status, tasks.priority);

    const [{ value: overdue }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.companyId, req.tenant.companyId),
          isNull(tasks.deletedAt),
          lt(tasks.dueAt, now),
          inArray(tasks.status, ['open', 'scheduled', 'in_progress', 'blocked']),
        ),
      );

    res.json(ok({ byStatusPriority: rows, overdue: Number(overdue) }));
  } catch (err) {
    next(err);
  }
});

// -------- GET one --------
tasksRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select({
        task: tasks,
        template: taskTemplates,
        branchNameEn: branches.nameEn,
        branchNameAr: branches.nameAr,
        areaNameEn: areas.nameEn,
        areaNameAr: areas.nameAr,
      })
      .from(tasks)
      .leftJoin(taskTemplates, eq(taskTemplates.id, tasks.templateId))
      .leftJoin(branches, eq(branches.id, tasks.branchId))
      .leftJoin(areas, eq(areas.id, tasks.areaId))
      .where(and(eq(tasks.id, id), eq(tasks.companyId, req.tenant.companyId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Task');

    const assignees = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, id));

    const dependencies = await db
      .select()
      .from(taskDependencies)
      .where(or(eq(taskDependencies.taskId, id), eq(taskDependencies.blocksTaskId, id))!);

    res.json(
      ok({
        ...row.task,
        template: row.template,
        branch: { id: row.task.branchId, nameEn: row.branchNameEn, nameAr: row.branchNameAr },
        area: row.task.areaId ? { id: row.task.areaId, nameEn: row.areaNameEn, nameAr: row.areaNameAr } : null,
        assignees,
        dependencies,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// -------- CREATE --------
const createSchema = z.object({
  branchId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  targetType: polymorphicTarget,
  targetId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  kind: kind.default('ad_hoc'),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  priority: priority.default('normal'),
  riskLevel: risk.default('medium'),
  primaryAssigneeUserId: z.string().uuid().nullable().optional(),
  assignedRoleKey: z.string().max(64).nullable().optional(),
  scheduledStartAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

tasksRouter.post('/', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = createSchema.parse(req.body);

    const [branch] = await db
      .select({ id: branches.id, city: branches.city })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.companyId, req.tenant.companyId)))
      .limit(1);
    if (!branch) throw errors.notFound('Branch');

    // Hydrate template if provided (copies checklist items → checklistState)
    let checklistState: Record<string, { done: boolean }> = {};
    let template = null as null | { id: string; checklistItems: Array<{ key: string }> };
    if (input.templateId) {
      const [tpl] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, input.templateId)).limit(1);
      if (!tpl) throw errors.notFound('Template');
      template = { id: tpl.id, checklistItems: tpl.checklistItems };
      checklistState = Object.fromEntries((tpl.checklistItems ?? []).map((c) => [c.key, { done: false }]));
    }

    const { aiSummary, aiMetadata } = composeTaskAiFields({
      titleEn: input.titleEn,
      kind: input.kind,
      status: 'open',
      priority: input.priority,
      branchCity: branch.city,
    });

    const [created] = await db
      .insert(tasks)
      .values({
        companyId: req.tenant.companyId,
        branchId: input.branchId,
        areaId: input.areaId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        templateId: template?.id ?? null,
        source: 'manual',
        kind: input.kind,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        description: input.description ?? null,
        status: 'open',
        priority: input.priority,
        riskLevel: input.riskLevel,
        primaryAssigneeUserId: input.primaryAssigneeUserId ?? null,
        assignedRoleKey: input.assignedRoleKey ?? null,
        scheduledStartAt: input.scheduledStartAt ? new Date(input.scheduledStartAt) : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        checklistState,
        aiSummary,
        aiMetadata,
      })
      .returning();

    if (input.primaryAssigneeUserId) {
      await db.insert(taskAssignments).values({
        companyId: req.tenant.companyId,
        taskId: created.id,
        userId: input.primaryAssigneeUserId,
        assignedByUserId: req.tenant.userId,
        isPrimary: true,
      });
    }

    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: created.id,
      eventType: 'created',
      actorUserId: req.tenant.userId,
      after: { titleEn: created.titleEn, dueAt: created.dueAt, priority: created.priority },
    });

    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// -------- PATCH (non-status fields) --------
const patchSchema = z.object({
  titleAr: z.string().min(1).max(255).optional(),
  titleEn: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  priority: priority.optional(),
  riskLevel: risk.optional(),
  areaId: z.string().uuid().nullable().optional(),
  primaryAssigneeUserId: z.string().uuid().nullable().optional(),
  assignedRoleKey: z.string().max(64).nullable().optional(),
  scheduledStartAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
});

tasksRouter.patch('/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);

    const [before] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.companyId, req.tenant.companyId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!before) throw errors.notFound('Task');

    const [updated] = await db
      .update(tasks)
      .set({
        ...patch,
        scheduledStartAt: patch.scheduledStartAt !== undefined ? (patch.scheduledStartAt ? new Date(patch.scheduledStartAt) : null) : undefined,
        dueAt: patch.dueAt !== undefined ? (patch.dueAt ? new Date(patch.dueAt) : null) : undefined,
        updatedAt: sql`now()`,
      })
      .where(eq(tasks.id, id))
      .returning();

    if ('priority' in patch && before.priority !== updated.priority) {
      await emitTaskEvent({
        companyId: req.tenant.companyId,
        taskId: id,
        eventType: 'priority_changed',
        actorUserId: req.tenant.userId,
        before: { priority: before.priority },
        after: { priority: updated.priority },
      });
    }
    if ('dueAt' in patch && String(before.dueAt) !== String(updated.dueAt)) {
      await emitTaskEvent({
        companyId: req.tenant.companyId,
        taskId: id,
        eventType: 'rescheduled',
        actorUserId: req.tenant.userId,
        before: { dueAt: before.dueAt },
        after: { dueAt: updated.dueAt },
      });
    }
    if ('primaryAssigneeUserId' in patch && before.primaryAssigneeUserId !== updated.primaryAssigneeUserId) {
      await emitTaskEvent({
        companyId: req.tenant.companyId,
        taskId: id,
        eventType: 'reassigned',
        actorUserId: req.tenant.userId,
        before: { primaryAssigneeUserId: before.primaryAssigneeUserId },
        after: { primaryAssigneeUserId: updated.primaryAssigneeUserId },
      });
    }
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// -------- Status transitions --------
async function transition(
  req: Parameters<typeof tasksRouter.post>[1] extends never ? never : import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
  targetStatus: 'in_progress' | 'in_review' | 'completed' | 'verified' | 'cancelled' | 'blocked',
  eventType: 'started' | 'submitted_for_review' | 'completed' | 'verified' | 'cancelled' | 'blocked',
  extras?: Record<string, unknown>,
) {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [before] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.companyId, req.tenant.companyId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!before) throw errors.notFound('Task');

    const updates: Record<string, unknown> = { status: targetStatus, updatedAt: sql`now()` };
    if (targetStatus === 'in_progress') updates.startedAt = sql`now()`;
    if (targetStatus === 'completed') {
      updates.completedAt = sql`now()`;
      updates.completedByUserId = req.tenant.userId;
    }
    if (targetStatus === 'verified') {
      updates.verifiedAt = sql`now()`;
      updates.verifiedByUserId = req.tenant.userId;
    }
    if (targetStatus === 'cancelled') updates.cancelledAt = sql`now()`;
    Object.assign(updates, extras ?? {});

    const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();

    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType,
      actorUserId: req.tenant.userId,
      before: { status: before.status },
      after: { status: updated.status },
    });
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'status_changed',
      actorUserId: req.tenant.userId,
      before: { status: before.status },
      after: { status: updated.status },
    });

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
}

tasksRouter.post('/:id/start',    requireRole(...writeRoles),  (req, res, next) => transition(req, res, next, 'in_progress', 'started'));
tasksRouter.post('/:id/submit',   requireRole(...writeRoles),  (req, res, next) => transition(req, res, next, 'in_review', 'submitted_for_review'));
tasksRouter.post('/:id/complete', requireRole(...writeRoles),  (req, res, next) => {
  const body = z.object({ notes: z.string().nullable().optional() }).parse(req.body ?? {});
  return transition(req, res, next, 'completed', 'completed', { completionNotes: body.notes ?? null });
});
tasksRouter.post('/:id/verify',   requireRole(...verifyRoles), (req, res, next) => transition(req, res, next, 'verified', 'verified'));
tasksRouter.post('/:id/cancel',   requireRole(...writeRoles),  (req, res, next) => {
  const body = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
  return transition(req, res, next, 'cancelled', 'cancelled', { cancelReason: body.reason });
});
tasksRouter.post('/:id/block',    requireRole(...writeRoles),  (req, res, next) => {
  const body = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
  return transition(req, res, next, 'blocked', 'blocked', { metadata: sql`jsonb_set(coalesce(${tasks.metadata},'{}'), '{blockReason}', to_jsonb(${body.reason}::text))` });
});

// -------- Events --------
tasksRouter.get('/:id/events', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(taskEvents)
      .where(and(eq(taskEvents.taskId, id), eq(taskEvents.companyId, req.tenant.companyId)))
      .orderBy(desc(taskEvents.createdAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

// -------- Comments --------
tasksRouter.get('/:id/comments', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(taskComments)
      .where(and(eq(taskComments.taskId, id), eq(taskComments.companyId, req.tenant.companyId)))
      .orderBy(desc(taskComments.createdAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/comments', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        body: z.string().min(1).max(5000),
        mentionsUserIds: z.array(z.string().uuid()).default([]),
      })
      .parse(req.body);
    const [created] = await db
      .insert(taskComments)
      .values({
        companyId: req.tenant.companyId,
        taskId: id,
        authorUserId: req.tenant.userId,
        body: body.body,
        mentionsUserIds: body.mentionsUserIds,
      })
      .returning();
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'comment_added',
      actorUserId: req.tenant.userId,
      after: { commentId: created.id, mentions: body.mentionsUserIds },
    });
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

// -------- Assignments --------
tasksRouter.post('/:id/assign', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({ userId: z.string().uuid(), isPrimary: z.boolean().default(false) })
      .parse(req.body);

    await db
      .insert(taskAssignments)
      .values({
        companyId: req.tenant.companyId,
        taskId: id,
        userId: body.userId,
        assignedByUserId: req.tenant.userId,
        isPrimary: body.isPrimary,
      })
      .onConflictDoNothing();

    if (body.isPrimary) {
      await db.update(taskAssignments).set({ isPrimary: false }).where(and(eq(taskAssignments.taskId, id), sql`${taskAssignments.userId} != ${body.userId}`));
      await db.update(tasks).set({ primaryAssigneeUserId: body.userId, updatedAt: sql`now()` }).where(eq(tasks.id, id));
    }

    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'assigned',
      actorUserId: req.tenant.userId,
      after: { userId: body.userId, isPrimary: body.isPrimary },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:id/assign/:userId', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const userId = z.string().uuid().parse(req.params.userId);
    await db.delete(taskAssignments).where(and(eq(taskAssignments.taskId, id), eq(taskAssignments.userId, userId)));
    const [task] = await db.select({ primaryAssigneeUserId: tasks.primaryAssigneeUserId }).from(tasks).where(eq(tasks.id, id)).limit(1);
    if (task?.primaryAssigneeUserId === userId) {
      await db.update(tasks).set({ primaryAssigneeUserId: null, updatedAt: sql`now()` }).where(eq(tasks.id, id));
    }
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'unassigned',
      actorUserId: req.tenant.userId,
      before: { userId },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// -------- Checklist --------
tasksRouter.patch('/:id/checklist/:itemKey', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const itemKey = z.string().min(1).max(128).parse(req.params.itemKey);
    const body = z.object({ done: z.boolean(), note: z.string().nullable().optional(), value: z.unknown().optional() }).parse(req.body);

    const [before] = await db
      .select({ checklistState: tasks.checklistState })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.companyId, req.tenant.companyId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!before) throw errors.notFound('Task');

    const nextState = {
      ...before.checklistState,
      [itemKey]: {
        done: body.done,
        note: body.note ?? undefined,
        value: body.value,
        at: new Date().toISOString(),
        byUserId: req.tenant.userId,
      },
    };
    await db.update(tasks).set({ checklistState: nextState, updatedAt: sql`now()` }).where(eq(tasks.id, id));
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: body.done ? 'checklist_item_completed' : 'checklist_item_uncompleted',
      actorUserId: req.tenant.userId,
      after: { itemKey, note: body.note ?? null },
    });
    res.json(ok({ checklistState: nextState }));
  } catch (err) {
    next(err);
  }
});

// -------- Time entries --------
tasksRouter.post('/:id/time-entries', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime().nullable().optional(),
        minutes: z.number().int().min(0).nullable().optional(),
        note: z.string().nullable().optional(),
      })
      .parse(req.body);
    const [created] = await db
      .insert(taskTimeEntries)
      .values({
        companyId: req.tenant.companyId,
        taskId: id,
        userId: req.tenant.userId,
        startedAt: new Date(body.startedAt),
        endedAt: body.endedAt ? new Date(body.endedAt) : null,
        minutes: body.minutes ?? null,
        note: body.note ?? null,
      })
      .returning();
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'time_logged',
      actorUserId: req.tenant.userId,
      after: { entryId: created.id, minutes: body.minutes ?? null },
    });
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/:id/time-entries', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(taskTimeEntries)
      .where(and(eq(taskTimeEntries.taskId, id), eq(taskTimeEntries.companyId, req.tenant.companyId)))
      .orderBy(desc(taskTimeEntries.startedAt));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

// -------- Dependencies --------
tasksRouter.post('/:id/dependencies', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const body = z.object({ blocksTaskId: z.string().uuid() }).parse(req.body);
    if (id === body.blocksTaskId) throw errors.badRequest({ ar: 'لا يمكن أن تعتمد المهمة على نفسها', en: 'A task cannot depend on itself' });
    await db
      .insert(taskDependencies)
      .values({ companyId: req.tenant.companyId, taskId: id, blocksTaskId: body.blocksTaskId })
      .onConflictDoNothing();
    await emitTaskEvent({
      companyId: req.tenant.companyId,
      taskId: id,
      eventType: 'dependency_added',
      actorUserId: req.tenant.userId,
      after: { blocksTaskId: body.blocksTaskId },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Suppress unused imports
void gt;
