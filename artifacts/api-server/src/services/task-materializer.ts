import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import {
  db,
  assets,
  areas,
  branches,
  maintenanceSchedules,
  taskTemplates,
  tasks,
} from '@rcos/db';
import { composeTaskAiFields, emitTaskEvent } from './task-events.js';
import { logger } from '../lib/logger.js';

/**
 * Materialize a task from a maintenance schedule. Idempotent per
 * (scheduleId, nextDueAt) — if a task already exists for the current due
 * window we skip and just advance the schedule.
 *
 * This is the seam that Phase 4 (Inspection Engine) and Phase 6 (HACCP CCP
 * deviations) will mimic: any recurring or triggered work condenses into a
 * task through this shape.
 */
export async function materializeFromSchedule(scheduleId: string): Promise<{ taskId?: string; skipped?: string }> {
  const [schedule] = await db
    .select()
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.id, scheduleId))
    .limit(1);
  if (!schedule) return { skipped: 'schedule not found' };
  if (!schedule.isActive) return { skipped: 'schedule inactive' };
  if (!schedule.assetId) return { skipped: 'category-scoped schedules require asset expansion (deferred)' };
  if (!schedule.nextDueAt) return { skipped: 'no nextDueAt' };

  // Idempotency guard — one open/scheduled task per (source, sourceId, dueAt)
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.source, 'maintenance_schedule'),
        eq(tasks.sourceId, schedule.id),
        eq(tasks.dueAt, schedule.nextDueAt),
      ),
    )
    .limit(1);
  if (existing) {
    logger.debug({ scheduleId, taskId: existing.id }, 'task already materialized for this schedule window');
    return { skipped: 'already materialized' };
  }

  const [asset] = await db.select().from(assets).where(eq(assets.id, schedule.assetId)).limit(1);
  if (!asset) return { skipped: 'asset missing' };

  const [branch] = await db.select({ city: branches.city }).from(branches).where(eq(branches.id, asset.branchId)).limit(1);
  const [area] = asset.areaId
    ? await db.select({ kind: areas.kind, nameEn: areas.nameEn }).from(areas).where(eq(areas.id, asset.areaId)).limit(1)
    : [];

  const titleEn = `${schedule.titleEn} — ${asset.nameEn}`;
  const titleAr = `${schedule.titleAr} — ${asset.nameAr}`;
  const { aiSummary, aiMetadata } = composeTaskAiFields({
    titleEn,
    kind: 'maintenance',
    status: 'open',
    priority: schedule.riskIfSkipped === 'critical' ? 'critical' : 'normal',
    targetLabel: asset.nameEn,
    branchCity: branch?.city ?? null,
    areaKind: area?.kind ?? null,
  });

  const [created] = await db
    .insert(tasks)
    .values({
      companyId: schedule.companyId,
      branchId: asset.branchId,
      areaId: asset.areaId,
      targetType: 'asset',
      targetId: asset.id,
      source: 'maintenance_schedule',
      sourceId: schedule.id,
      kind: 'maintenance',
      titleAr,
      titleEn,
      description: schedule.description,
      status: 'open',
      priority: schedule.riskIfSkipped === 'critical' ? 'critical' : schedule.riskIfSkipped === 'high' ? 'high' : 'normal',
      riskLevel: schedule.riskIfSkipped,
      scheduledStartAt: schedule.nextDueAt,
      dueAt: schedule.nextDueAt,
      estimatedDurationMinutes: schedule.estimatedDurationMinutes,
      aiSummary,
      aiMetadata: {
        ...aiMetadata,
        materializedFromScheduleId: schedule.id,
        requiresShutdown: schedule.requiresShutdown,
      },
      metadata: { playbook: schedule.playbook },
    })
    .returning({ id: tasks.id });

  await emitTaskEvent({
    companyId: schedule.companyId,
    taskId: created.id,
    eventType: 'created',
    source: 'system',
    after: {
      titleEn,
      dueAt: schedule.nextDueAt,
      assetId: asset.id,
      scheduleId: schedule.id,
      trigger: 'materialize',
    },
  });

  await db
    .update(maintenanceSchedules)
    .set({ lastGeneratedAt: sql`now()`, nextDueAt: advanceNextDue(schedule.frequency, schedule.nextDueAt, schedule.intervalCount) })
    .where(eq(maintenanceSchedules.id, schedule.id));

  return { taskId: created.id };
}

/**
 * Advance next_due_at based on frequency. Handles daily/weekly/monthly/etc.
 * Custom / usage_based / condition_based don't auto-advance — they're driven
 * by external triggers (usage counters, sensor telemetry) added later.
 */
function advanceNextDue(frequency: string, current: Date, intervalCount: number): Date | null {
  const d = new Date(current.getTime());
  const n = Math.max(1, intervalCount);
  switch (frequency) {
    case 'daily':        d.setDate(d.getDate() + n); return d;
    case 'weekly':       d.setDate(d.getDate() + 7 * n); return d;
    case 'biweekly':     d.setDate(d.getDate() + 14 * n); return d;
    case 'monthly':      d.setMonth(d.getMonth() + n); return d;
    case 'bimonthly':    d.setMonth(d.getMonth() + 2 * n); return d;
    case 'quarterly':    d.setMonth(d.getMonth() + 3 * n); return d;
    case 'semi_annually':d.setMonth(d.getMonth() + 6 * n); return d;
    case 'annually':     d.setFullYear(d.getFullYear() + n); return d;
    default:             return null; // usage_based / condition_based / custom → externally advanced
  }
}

/**
 * Runs one materialization tick — inspects every active schedule due within
 * the horizon and materializes tasks for each. Called by the interval-based
 * job runner AND by the /jobs/materialize admin endpoint (Phase 8 will call
 * this after predicting an early due).
 */
export async function runMaterializationTick(horizonHours = 24): Promise<{ scanned: number; materialized: number; skipped: number }> {
  const horizon = new Date(Date.now() + horizonHours * 3_600_000);
  const dueSchedules = await db
    .select({ id: maintenanceSchedules.id })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.isActive, true),
        lte(maintenanceSchedules.nextDueAt, horizon),
        // categoryId=null means asset-scoped
        isNull(maintenanceSchedules.categoryId),
      ),
    );

  let materialized = 0;
  let skipped = 0;
  for (const s of dueSchedules) {
    const r = await materializeFromSchedule(s.id);
    if (r.taskId) materialized++;
    else skipped++;
  }
  return { scanned: dueSchedules.length, materialized, skipped };
}

// Suppress unused
void taskTemplates;
