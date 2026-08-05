import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { ccpMonitoringResultEnum } from './enums.js';
import { assets } from './assets.js';
import { branches } from './branches.js';
import { ccps } from './ccps.js';
import { companies } from './companies.js';

/**
 * A single monitoring reading against a CCP. On out-of-limit readings, the
 * ccp-monitoring service auto-creates a finding + critical task + writes an
 * asset event. `result` is computed by the service.
 */
export const ccpMonitoringLogs = pgTable(
  'ccp_monitoring_logs',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    ccpId: uuid('ccp_id').notNull().references(() => ccps.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),

    // Structured measurements — one row can carry multiple metrics
    readings: jsonb('readings').$type<Record<string, number | string | null>>().notNull().default({}),
    // Primary numeric value for quick queries + chart rendering
    primaryValue: numeric('primary_value', { precision: 12, scale: 4 }),
    primaryUnit: varchar('primary_unit', { length: 16 }),

    result: ccpMonitoringResultEnum('result').notNull().default('in_limit'),
    isDeviation: boolean('is_deviation').notNull().default(false),
    deviationDetails: jsonb('deviation_details').$type<Record<string, unknown>>().notNull().default({}),

    // Cross-links populated by the ccp-monitoring service on deviations
    findingId: uuid('finding_id'),
    correctiveTaskId: uuid('corrective_task_id'),

    correctiveActionTaken: text('corrective_action_taken'),

    observedByUserId: uuid('observed_by_user_id'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('ccp_monitoring_ccp_idx').on(t.ccpId),
    index('ccp_monitoring_branch_idx').on(t.branchId),
    index('ccp_monitoring_result_idx').on(t.companyId, t.result),
    index('ccp_monitoring_observed_idx').on(t.ccpId, t.observedAt),
  ],
);

export type CcpMonitoringLog = typeof ccpMonitoringLogs.$inferSelect;
export type NewCcpMonitoringLog = typeof ccpMonitoringLogs.$inferInsert;
