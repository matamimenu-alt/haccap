import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tasks } from './tasks.js';

/**
 * task_a blocks task_b: task_b cannot start until task_a is completed/verified.
 * Enforced at application layer (route validation), not at DB constraint level,
 * so we can support "soft" dependencies later (warning vs. block).
 */
export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    blocksTaskId: uuid('blocks_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('task_dependencies_uidx').on(t.taskId, t.blocksTaskId),
    index('task_dependencies_blocks_idx').on(t.blocksTaskId),
  ],
);

export type TaskDependency = typeof taskDependencies.$inferSelect;
export type NewTaskDependency = typeof taskDependencies.$inferInsert;
