import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { assets } from './assets.js';
import { companies } from './companies.js';

/**
 * Calibration record for probes, thermometers, scales. Anchors the accuracy
 * of every temperature reading in the system.
 */
export const calibrationRecords = pgTable(
  'calibration_records',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),

    reference: varchar('reference', { length: 64 }),
    method: varchar('method', { length: 64 }).notNull().default('ice_point'),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    performedByUserId: uuid('performed_by_user_id'),

    expectedValue: numeric('expected_value', { precision: 8, scale: 3 }),
    measuredValue: numeric('measured_value', { precision: 8, scale: 3 }),
    tolerance: numeric('tolerance', { precision: 8, scale: 3 }),
    unit: varchar('unit', { length: 16 }).notNull().default('°C'),
    isPass: boolean('is_pass').notNull(),
    adjustmentMade: boolean('adjustment_made').notNull().default(false),

    nextDueOn: timestamp('next_due_on', { withTimezone: true }),
    certificateUrl: text('certificate_url'),
    notes: text('notes'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('calibration_records_asset_idx').on(t.assetId),
    index('calibration_records_company_idx').on(t.companyId),
    index('calibration_records_next_idx').on(t.companyId, t.nextDueOn),
  ],
);

export type CalibrationRecord = typeof calibrationRecords.$inferSelect;
export type NewCalibrationRecord = typeof calibrationRecords.$inferInsert;
