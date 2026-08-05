import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { receivingResultEnum } from './enums.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { suppliers } from './suppliers.js';

/**
 * Supplier delivery inspection. Each row is one delivery, with a jsonb array
 * of line items so we don't need a separate line-item table for Phase 6.
 * Traceability continues via the batches table.
 */
export const receivingLogs = pgTable(
  'receiving_logs',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),

    reference: varchar('reference', { length: 64 }),
    invoiceNumber: varchar('invoice_number', { length: 64 }),
    driverName: varchar('driver_name', { length: 128 }),
    vehiclePlate: varchar('vehicle_plate', { length: 32 }),

    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedByUserId: uuid('received_by_user_id'),

    // Temperature at receipt (checked for chilled/frozen goods)
    vehicleTempC: numeric('vehicle_temp_c', { precision: 6, scale: 2 }),
    productTempC: numeric('product_temp_c', { precision: 6, scale: 2 }),

    items: jsonb('items')
      .$type<Array<{
        nameEn: string; nameAr?: string;
        quantity: number; unit: string;
        batchNumber?: string; expiryDate?: string;
        temperatureC?: number;
        accepted: boolean; rejectReason?: string;
      }>>()
      .notNull()
      .default([]),

    result: receivingResultEnum('result').notNull().default('accepted'),
    findingId: uuid('finding_id'),
    correctiveTaskId: uuid('corrective_task_id'),

    notes: text('notes'),
    hasEvidence: boolean('has_evidence').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('receiving_logs_branch_idx').on(t.branchId),
    index('receiving_logs_supplier_idx').on(t.supplierId),
    index('receiving_logs_result_idx').on(t.companyId, t.result),
    index('receiving_logs_received_idx').on(t.branchId, t.receivedAt),
  ],
);

export type ReceivingLog = typeof receivingLogs.$inferSelect;
export type NewReceivingLog = typeof receivingLogs.$inferInsert;
