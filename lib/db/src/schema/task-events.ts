import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { taskEventTypeEnum } from './enums.js';
import { companies } from './companies.js';
import { tasks } from './tasks.js';

/**
 * IMMUTABLE task activity log. Same shape as `asset_events` — closed enum,
 * before/after payloads, ai_annotation write-back slot. Feeds the AI engine
 * (Phase 8) for overdue prediction, priority mismatch detection, staff
 * productivity, etc.
 */
export const taskEvents = pgTable(
  'task_events',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),

    eventType: taskEventTypeEnum('event_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    source: text('source').notNull().default('web'),

    payload: jsonb('payload').$type<{
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      delta?: Record<string, unknown>;
      note?: string;
      [key: string]: unknown;
    }>().notNull().default({}),

    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
    aiAnnotation: jsonb('ai_annotation').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('task_events_task_idx').on(t.taskId),
    index('task_events_company_idx').on(t.companyId),
    index('task_events_type_idx').on(t.companyId, t.eventType),
    index('task_events_task_created_idx').on(t.taskId, t.createdAt),
  ],
);

export type TaskEvent = typeof taskEvents.$inferSelect;
export type NewTaskEvent = typeof taskEvents.$inferInsert;
