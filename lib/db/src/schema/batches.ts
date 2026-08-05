import { boolean, date, index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { batchStatusEnum } from './enums.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { receivingLogs } from './receiving-logs.js';
import { suppliers } from './suppliers.js';

/**
 * A batch = a specific lot of a specific ingredient / product. This is the
 * unit of traceability: any incident can be traced back to a batch, and
 * any batch can be traced forward to what dishes / customers it went to.
 */
export const batches = pgTable(
  'batches',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    receivingLogId: uuid('receiving_log_id').references(() => receivingLogs.id, { onDelete: 'set null' }),

    // Human batch code (e.g. "CHK-2026-04-12-001")
    code: varchar('code', { length: 64 }).notNull(),
    productNameEn: varchar('product_name_en', { length: 255 }).notNull(),
    productNameAr: varchar('product_name_ar', { length: 255 }),
    supplierBatchNumber: varchar('supplier_batch_number', { length: 128 }),
    productionDate: date('production_date'),
    expiryDate: date('expiry_date'),

    initialQuantity: numeric('initial_quantity', { precision: 12, scale: 3 }),
    currentQuantity: numeric('current_quantity', { precision: 12, scale: 3 }),
    unit: varchar('unit', { length: 16 }),

    status: batchStatusEnum('status').notNull().default('received'),
    storageLocation: varchar('storage_location', { length: 128 }),
    allergenTags: jsonb('allergen_tags').$type<string[]>().notNull().default([]),

    isRecalled: boolean('is_recalled').notNull().default(false),
    recalledAt: timestamp('recalled_at', { withTimezone: true }),
    recallReason: text('recall_reason'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('batches_branch_idx').on(t.branchId),
    index('batches_supplier_idx').on(t.supplierId),
    index('batches_status_idx').on(t.companyId, t.status),
    index('batches_expiry_idx').on(t.companyId, t.expiryDate),
    index('batches_code_idx').on(t.companyId, t.code),
  ],
);

/**
 * Movements tie a batch to downstream consumption — used in prep, cooked
 * into dish, transferred to another branch, discarded, etc. The AI recall
 * assistant uses this graph.
 */
export const batchMovements = pgTable(
  'batch_movements',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),

    // kind: transferred, used_in_prep, cooked, discarded, returned
    kind: varchar('kind', { length: 32 }).notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }),
    unit: varchar('unit', { length: 16 }),
    note: text('note'),
    // downstream reference — recipe id, batch id, task id (soft link)
    downstreamRef: varchar('downstream_ref', { length: 128 }),
    performedByUserId: uuid('performed_by_user_id'),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('batch_movements_batch_idx').on(t.batchId),
    index('batch_movements_kind_idx').on(t.companyId, t.kind),
    index('batch_movements_performed_idx').on(t.batchId, t.performedAt),
  ],
);

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;
export type BatchMovement = typeof batchMovements.$inferSelect;
export type NewBatchMovement = typeof batchMovements.$inferInsert;
