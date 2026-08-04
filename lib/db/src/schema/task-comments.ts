import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tasks } from './tasks.js';

/**
 * Threaded comments on a task. Kept simple — one flat log per task.
 * `mentions_user_ids` powers the @-mention notification later.
 * AI can consume the body directly.
 */
export const taskComments = pgTable(
  'task_comments',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').notNull(),
    body: text('body').notNull(),
    mentionsUserIds: uuid('mentions_user_ids').array().notNull().default([]),
    // AI annotation — Phase 8 populates sentiment, action-item extraction, etc.
    aiAnnotation: jsonb('ai_annotation').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('task_comments_task_idx').on(t.taskId),
    index('task_comments_author_idx').on(t.authorUserId),
  ],
);

export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;
