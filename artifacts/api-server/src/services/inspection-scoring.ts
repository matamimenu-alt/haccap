import { and, eq } from 'drizzle-orm';
import {
  db,
  findings,
  inspectionEvents,
  inspectionResponses,
  inspections,
  tasks,
} from '@rcos/db';
import { logger } from '../lib/logger.js';
import { emitTaskEvent } from './task-events.js';

type Item = {
  key: string;
  sectionKey: string;
  weight?: number;
  critical?: boolean;
  type: 'yesno' | 'scale5' | 'numeric' | 'text';
  passIf?: { op: 'gte' | 'lte' | 'between'; value?: number; min?: number; max?: number };
  labelEn?: string;
  labelAr?: string;
  evidenceRequiredOnFail?: boolean;
};
type Section = { key: string; weight?: number; labelEn?: string; labelAr?: string };

export type ResponseInput = {
  value: 'pass' | 'fail' | 'partial' | 'not_applicable' | 'observed';
  numericValue?: number | null;
  textValue?: string | null;
  note?: string | null;
};

/**
 * Turn a response + item into a normalized 0–1 score and pass boolean.
 * For numeric items, pass is derived from `passIf`.
 */
export function scoreResponse(item: Item, r: ResponseInput): { score: number; isPass: boolean } {
  if (r.value === 'not_applicable') return { score: 1, isPass: true };

  if (item.type === 'numeric' && item.passIf && r.numericValue != null) {
    const v = Number(r.numericValue);
    let pass = false;
    if (item.passIf.op === 'gte' && item.passIf.value != null) pass = v >= item.passIf.value;
    if (item.passIf.op === 'lte' && item.passIf.value != null) pass = v <= item.passIf.value;
    if (item.passIf.op === 'between' && item.passIf.min != null && item.passIf.max != null) pass = v >= item.passIf.min && v <= item.passIf.max;
    return { score: pass ? 1 : 0, isPass: pass };
  }

  switch (r.value) {
    case 'pass':     return { score: 1,   isPass: true };
    case 'partial':  return { score: 0.5, isPass: false };
    case 'fail':     return { score: 0,   isPass: false };
    case 'observed': return { score: r.numericValue != null ? 1 : 0.5, isPass: r.numericValue != null };
    default:         return { score: 0, isPass: false };
  }
}

/**
 * Recompute inspection totals from every persisted response. Called after
 * every response mutation and at submit/finalize.
 */
export async function recomputeInspection(inspectionId: string) {
  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  if (!inspection) throw new Error('inspection missing');

  const snapshot = inspection.templateSnapshot as {
    sections: Section[];
    items: Item[];
    passThreshold?: number;
  };
  const items = new Map<string, Item>((snapshot.items ?? []).map((i) => [i.key, i]));
  const sections = snapshot.sections ?? [];

  const responses = await db
    .select()
    .from(inspectionResponses)
    .where(eq(inspectionResponses.inspectionId, inspectionId));

  const perSection = new Map<string, { totalScore: number; totalWeight: number; failures: number; criticalFail: number }>();
  let critical = 0;
  let major = 0;
  let minor = 0;

  for (const resp of responses) {
    const item = items.get(resp.itemKey);
    if (!item) continue;
    const weight = item.weight ?? 1;
    const isPass = resp.isPass ?? false;
    const score = Number(resp.score ?? 0);

    const agg = perSection.get(item.sectionKey) ?? { totalScore: 0, totalWeight: 0, failures: 0, criticalFail: 0 };
    if (resp.value !== 'not_applicable') {
      agg.totalScore  += score * weight;
      agg.totalWeight += weight;
    }
    if (!isPass && resp.value !== 'not_applicable') {
      agg.failures += 1;
      if (item.critical) {
        agg.criticalFail += 1;
        critical += 1;
      } else if (weight >= 2) {
        major += 1;
      } else {
        minor += 1;
      }
    }
    perSection.set(item.sectionKey, agg);
  }

  let totalScoreW = 0;
  let totalWeightW = 0;
  for (const section of sections) {
    const agg = perSection.get(section.key);
    if (!agg || agg.totalWeight === 0) continue;
    const sectionScore = agg.totalScore / agg.totalWeight;
    const sw = section.weight ?? 1;
    totalScoreW += sectionScore * sw;
    totalWeightW += sw;
  }
  const overall = totalWeightW > 0 ? (totalScoreW / totalWeightW) * 100 : 0;
  const passThreshold = snapshot.passThreshold ?? 80;
  const passed = critical === 0 && overall >= passThreshold;

  await db
    .update(inspections)
    .set({
      overallScore: overall.toFixed(2),
      overallPass: passed,
      criticalFailures: critical,
      majorFailures: major,
      minorFailures: minor,
      updatedAt: new Date(),
    })
    .where(eq(inspections.id, inspectionId));

  return { overall, passed, critical, major, minor };
}

/**
 * When an inspection is finalized, turn every failed response into a
 * finding, and auto-create a follow-up task per finding so the ops team
 * sees them on the board.
 */
export async function materializeFindingsFromResponses(inspectionId: string, actorUserId?: string) {
  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  if (!inspection) return;

  const snapshot = inspection.templateSnapshot as { items: Item[] };
  const itemsByKey = new Map((snapshot.items ?? []).map((i) => [i.key, i]));

  const responses = await db
    .select()
    .from(inspectionResponses)
    .where(and(eq(inspectionResponses.inspectionId, inspectionId), eq(inspectionResponses.isPass, false)));

  for (const resp of responses) {
    const item = itemsByKey.get(resp.itemKey);
    if (!item) continue;

    // Idempotency — skip if a finding already exists for this response
    const [existing] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(eq(findings.inspectionResponseId, resp.id))
      .limit(1);
    if (existing) continue;

    const severity: 'critical' | 'major' | 'minor' = item.critical
      ? 'critical'
      : (item.weight ?? 1) >= 2
        ? 'major'
        : 'minor';

    const [finding] = await db
      .insert(findings)
      .values({
        companyId: inspection.companyId,
        inspectionId,
        inspectionResponseId: resp.id,
        branchId: inspection.branchId,
        areaId: inspection.areaId,
        targetType: inspection.targetType,
        targetId: inspection.targetId,
        titleEn: item.labelEn ?? resp.itemKey,
        titleAr: item.labelAr ?? resp.itemKey,
        description: resp.note ?? null,
        severity,
        status: 'open',
        aiSummary: `${item.labelEn ?? resp.itemKey} · ${severity}`,
      })
      .returning();

    // Auto-create a follow-up task and cross-link
    const [task] = await db
      .insert(tasks)
      .values({
        companyId: inspection.companyId,
        branchId: inspection.branchId,
        areaId: inspection.areaId,
        targetType: inspection.targetType,
        targetId: inspection.targetId,
        source: 'inspection',
        sourceId: inspection.id,
        kind: 'inspection_followup',
        titleEn: `Follow-up: ${item.labelEn ?? resp.itemKey}`,
        titleAr: `متابعة: ${item.labelAr ?? resp.itemKey}`,
        description: resp.note ?? item.labelEn ?? null,
        status: 'open',
        priority: severity === 'critical' ? 'critical' : severity === 'major' ? 'high' : 'normal',
        riskLevel: severity === 'critical' ? 'critical' : severity === 'major' ? 'high' : 'medium',
        aiSummary: `Follow-up from inspection ${inspection.reference ?? inspection.id.slice(0, 8)}`,
        aiMetadata: { source: 'inspection_followup', findingId: finding.id, severity },
        metadata: { findingId: finding.id },
      })
      .returning({ id: tasks.id });

    await db
      .update(findings)
      .set({ followupTaskId: task.id, updatedAt: new Date() })
      .where(eq(findings.id, finding.id));

    await emitTaskEvent({
      companyId: inspection.companyId,
      taskId: task.id,
      eventType: 'created',
      actorUserId,
      source: 'system',
      after: { source: 'inspection_followup', findingId: finding.id, severity },
    });

    await db.insert(inspectionEvents).values({
      companyId: inspection.companyId,
      inspectionId,
      eventType: 'finding_created',
      actorUserId,
      source: 'system',
      payload: { findingId: finding.id, severity, taskId: task.id },
    });
  }
  logger.debug({ inspectionId, count: responses.length }, 'findings materialized');
}
