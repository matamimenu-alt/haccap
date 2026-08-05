import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { pestControlResultEnum } from './enums.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { suppliers } from './suppliers.js';

/**
 * Pest control visit record. Contracted vendor (supplier) or internal team.
 * Captures findings, treatments, and any evidence of infestation.
 */
export const pestControlRecords = pgTable(
  'pest_control_records',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),

    reference: varchar('reference', { length: 64 }),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull(),
    technicianName: varchar('technician_name', { length: 128 }),

    result: pestControlResultEnum('result').notNull().default('clear'),
    findings: jsonb('findings').$type<Array<{ location: string; pest?: string; severity?: string; note?: string }>>().notNull().default([]),
    treatmentsApplied: jsonb('treatments_applied').$type<Array<{ chemical?: string; method: string; location?: string; safetyPeriodHours?: number }>>().notNull().default([]),

    stationsChecked: jsonb('stations_checked').$type<Array<{ id: string; status: string }>>().notNull().default([]),
    recommendations: text('recommendations'),
    nextVisitDueOn: timestamp('next_visit_due_on', { withTimezone: true }),

    findingRecordId: uuid('finding_record_id'), // link to findings row if evidence found
    correctiveTaskId: uuid('corrective_task_id'),

    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('pest_control_records_branch_idx').on(t.branchId),
    index('pest_control_records_supplier_idx').on(t.supplierId),
    index('pest_control_records_result_idx').on(t.companyId, t.result),
    index('pest_control_records_next_idx').on(t.companyId, t.nextVisitDueOn),
  ],
);

export type PestControlRecord = typeof pestControlRecords.$inferSelect;
export type NewPestControlRecord = typeof pestControlRecords.$inferInsert;
