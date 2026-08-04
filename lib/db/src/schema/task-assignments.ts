import { boolean, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tasks } from './tasks.js';

/**
 * Many-to-many between tasks and users. `is_primary` mirrors
 * `tasks.primary_assignee_user_id` for the board renderer. `accepted_at` is
 * set when the assignee acknowledges the assignment (Phase 3 optional flow).
 */
export const taskAssignments = pgTable(
  'task_assignments',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    assignedByUserId: uuid('assigned_by_user_id'),
    isPrimary: boolean('is_primary').notNull().default(false),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('task_assignments_uidx').on(t.taskId, t.userId),
    index('task_assignments_user_idx').on(t.userId),
    index('task_assignments_task_idx').on(t.taskId),
  ],
);

export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;
