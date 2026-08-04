import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tasks } from './tasks.js';

/**
 * Time logged against a task by a user. Used to roll up actual duration and
 * feed the AI engine's productivity models.
 */
export const taskTimeEntries = pgTable(
  'task_time_entries',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    minutes: integer('minutes'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('task_time_entries_task_idx').on(t.taskId),
    index('task_time_entries_user_idx').on(t.userId),
  ],
);

export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type NewTaskTimeEntry = typeof taskTimeEntries.$inferInsert;
