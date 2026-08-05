import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { areas } from './areas.js';
import { branches } from './branches.js';
import { companies } from './companies.js';

/**
 * Cleaning + sanitation completion log. Ties to a specific area (or the whole
 * branch), captures chemicals + method + supervisor sign-off.
 */
export const cleaningRecords = pgTable(
  'cleaning_records',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),

    // frequency category: opening / daily / weekly / monthly / deep_clean
    frequency: varchar('frequency', { length: 32 }).notNull().default('daily'),
    scopeDescription: text('scope_description'),

    performedByUserId: uuid('performed_by_user_id'),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),

    supervisorUserId: uuid('supervisor_user_id'),
    supervisorSignedAt: timestamp('supervisor_signed_at', { withTimezone: true }),

    chemicals: jsonb('chemicals').$type<Array<{ name: string; concentration?: string; contactMinutes?: number }>>().notNull().default([]),
    method: varchar('method', { length: 64 }),
    atpSwabRlu: varchar('atp_swab_rlu', { length: 16 }), // Rlu reading if ATP tested

    notes: text('notes'),
    isVerified: boolean('is_verified').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('cleaning_records_branch_idx').on(t.branchId),
    index('cleaning_records_area_idx').on(t.areaId),
    index('cleaning_records_performed_idx').on(t.branchId, t.performedAt),
  ],
);

export type CleaningRecord = typeof cleaningRecords.$inferSelect;
export type NewCleaningRecord = typeof cleaningRecords.$inferInsert;
