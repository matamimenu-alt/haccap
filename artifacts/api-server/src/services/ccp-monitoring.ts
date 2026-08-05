import { eq } from 'drizzle-orm';
import { db, ccpMonitoringLogs, ccps, findings, tasks } from '@rcos/db';
import type { NewCcpMonitoringLog } from '@rcos/db';
import { emitTaskEvent } from './task-events.js';

type Limit = {
  metric: string;
  op: 'gte' | 'lte' | 'between' | 'eq';
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  labelEn?: string;
  labelAr?: string;
};

export function evaluateReadingAgainstLimits(
  readings: Record<string, number | string | null>,
  limits: Limit[],
): { result: NewCcpMonitoringLog['result']; violations: Array<{ metric: string; limit: Limit; observed: unknown }> } {
  const violations: Array<{ metric: string; limit: Limit; observed: unknown }> = [];
  for (const limit of limits) {
    const raw = readings[limit.metric];
    if (raw == null || raw === '') continue; // not observed → skip
    const v = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(v)) continue;
    let inLimit = true;
    if (limit.op === 'gte' && limit.value != null) inLimit = v >= limit.value;
    if (limit.op === 'lte' && limit.value != null) inLimit = v <= limit.value;
    if (limit.op === 'eq'  && limit.value != null) inLimit = v === limit.value;
    if (limit.op === 'between' && limit.min != null && limit.max != null) inLimit = v >= limit.min && v <= limit.max;
    if (!inLimit) violations.push({ metric: limit.metric, limit, observed: v });
  }
  if (violations.length === 0) return { result: 'in_limit', violations };
  // Distinguish warning vs deviation vs critical:
  // - deviation if any critical-limit violated by ≤10%
  // - critical_deviation if any violated by >10% or multiple violations
  const worstDeviationPct = Math.max(
    ...violations.map((vi) => {
      const target = vi.limit.value ?? (vi.limit.op === 'between' ? ((vi.limit.min! + vi.limit.max!) / 2) : NaN);
      if (Number.isNaN(target) || target === 0) return 100;
      return Math.abs((Number(vi.observed) - target) / target) * 100;
    }),
  );
  const result: NewCcpMonitoringLog['result'] =
    worstDeviationPct > 10 || violations.length >= 2 ? 'critical_deviation' : 'deviation';
  return { result, violations };
}

/**
 * On out-of-limit CCP monitoring reads, materialize a finding + critical
 * follow-up task and cross-link back to the monitoring log. Runs after the
 * log is inserted so it can reference the log id.
 */
export async function materializeCcpDeviation(logId: string, actorUserId?: string) {
  const [row] = await db
    .select({ log: ccpMonitoringLogs, ccp: ccps })
    .from(ccpMonitoringLogs)
    .innerJoin(ccps, eq(ccps.id, ccpMonitoringLogs.ccpId))
    .where(eq(ccpMonitoringLogs.id, logId))
    .limit(1);
  if (!row) return;
  const { log, ccp } = row;
  if (!log.isDeviation) return;

  const [finding] = await db
    .insert(findings)
    .values({
      companyId: log.companyId,
      branchId: log.branchId,
      areaId: null,
      targetType: log.assetId ? 'asset' : 'branch',
      targetId: log.assetId ?? log.branchId,
      titleEn: `CCP deviation — ${ccp.titleEn}`,
      titleAr: `انحراف نقطة تحكم — ${ccp.titleAr}`,
      description: log.correctiveActionTaken ?? null,
      severity: log.result === 'critical_deviation' ? 'critical' : 'major',
      status: 'open',
      aiSummary: `${ccp.titleEn} · ${log.result} · ${JSON.stringify(log.readings)}`,
      aiMetadata: { source: 'ccp_deviation', ccpId: ccp.id, result: log.result, readings: log.readings, deviation: log.deviationDetails },
    })
    .returning();

  const [task] = await db
    .insert(tasks)
    .values({
      companyId: log.companyId,
      branchId: log.branchId,
      areaId: null,
      targetType: log.assetId ? 'asset' : 'branch',
      targetId: log.assetId ?? log.branchId,
      source: 'ccp_deviation',
      sourceId: log.id,
      kind: 'capa_action',
      titleEn: `CAPA — ${ccp.titleEn}`,
      titleAr: `إجراء تصحيحي — ${ccp.titleAr}`,
      description: `Deviation on CCP ${ccp.reference}. Apply corrective-action playbook and record outcome.`,
      status: 'open',
      priority: log.result === 'critical_deviation' ? 'critical' : 'urgent',
      riskLevel: log.result === 'critical_deviation' ? 'critical' : 'high',
      aiSummary: `CAPA for ${ccp.titleEn}`,
      aiMetadata: { source: 'ccp_deviation', ccpId: ccp.id, findingId: finding.id, playbook: ccp.correctiveActionPlaybook },
      metadata: { findingId: finding.id, ccpId: ccp.id, monitoringLogId: log.id, playbook: ccp.correctiveActionPlaybook },
    })
    .returning();

  await db
    .update(findings)
    .set({ followupTaskId: task.id, updatedAt: new Date() })
    .where(eq(findings.id, finding.id));

  await db
    .update(ccpMonitoringLogs)
    .set({ findingId: finding.id, correctiveTaskId: task.id })
    .where(eq(ccpMonitoringLogs.id, log.id));

  await emitTaskEvent({
    companyId: log.companyId,
    taskId: task.id,
    eventType: 'created',
    actorUserId,
    source: 'system',
    after: { source: 'ccp_deviation', ccpId: ccp.id, monitoringLogId: log.id, findingId: finding.id },
  });
}
