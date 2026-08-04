import { db, taskEvents } from '@rcos/db';
import type { NewTaskEvent } from '@rcos/db';

export type EmitTaskEventInput = {
  companyId: string;
  taskId: string;
  eventType: NewTaskEvent['eventType'];
  actorUserId?: string | null;
  source?: string;
  before?: Record<string, unknown> | undefined;
  after?: Record<string, unknown> | undefined;
  delta?: Record<string, unknown> | undefined;
  note?: string;
  context?: Record<string, unknown>;
};

export async function emitTaskEvent(input: EmitTaskEventInput): Promise<void> {
  try {
    await db.insert(taskEvents).values({
      companyId: input.companyId,
      taskId: input.taskId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      source: input.source ?? 'web',
      payload: {
        ...(input.before !== undefined ? { before: input.before } : {}),
        ...(input.after !== undefined ? { after: input.after } : {}),
        ...(input.delta !== undefined ? { delta: input.delta } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
      context: input.context ?? {},
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('emitTaskEvent failed', err);
  }
}

/**
 * Compose a task's AI-consumable summary and feature bag. Kept simple —
 * Phase 8 will replace with richer LLM-generated summaries.
 */
export function composeTaskAiFields(input: {
  titleEn: string;
  kind: string;
  status: string;
  priority: string;
  targetLabel?: string | null;
  branchCity?: string | null;
  areaKind?: string | null;
}): { aiSummary: string; aiMetadata: Record<string, unknown> } {
  const parts = [input.titleEn, input.kind, input.priority, input.targetLabel, input.branchCity, input.areaKind]
    .filter(Boolean)
    .join(' · ');
  return {
    aiSummary: parts,
    aiMetadata: {
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      target: input.targetLabel ?? null,
      areaKind: input.areaKind ?? null,
    },
  };
}
