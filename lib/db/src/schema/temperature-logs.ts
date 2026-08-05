import { boolean, index, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { areas } from './areas.js';
import { assets } from './assets.js';
import { branches } from './branches.js';
import { companies } from './companies.js';

/**
 * General-purpose temperature log — walk-ins, hot-holding, freezers, cooked
 * dishes, deliveries. Separate from CCP monitoring so that non-CCP temperature
 * tracking (routine walkthroughs) doesn't clutter the CCP dataset.
 */
export const temperatureLogs = pgTable(
  'temperature_logs',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),

    kind: varchar('kind', { length: 32 }).notNull().default('spot'),
    valueC: numeric('value_c', { precision: 6, scale: 2 }).notNull(),
    targetMinC: numeric('target_min_c', { precision: 6, scale: 2 }),
    targetMaxC: numeric('target_max_c', { precision: 6, scale: 2 }),
    isInRange: boolean('is_in_range'),
    probeAssetId: uuid('probe_asset_id'),
    observedByUserId: uuid('observed_by_user_id'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('temperature_logs_branch_idx').on(t.branchId),
    index('temperature_logs_area_idx').on(t.areaId),
    index('temperature_logs_asset_idx').on(t.assetId),
    index('temperature_logs_observed_idx').on(t.branchId, t.observedAt),
  ],
);

export type TemperatureLog = typeof temperatureLogs.$inferSelect;
export type NewTemperatureLog = typeof temperatureLogs.$inferInsert;
