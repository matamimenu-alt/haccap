import { boolean, index, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { inspectionResponseValueEnum } from './enums.js';
import { companies } from './companies.js';
import { inspections } from './inspections.js';

/**
 * One row per (inspection, item). Projected from the template snapshot at
 * inspection creation. `value` is the categorical outcome; `numericValue`
 * and `textValue` capture measurements when the item is numeric/text.
 * `score` is derived by the service from value + item weight + critical flag.
 */
export const inspectionResponses = pgTable(
  'inspection_responses',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id, { onDelete: 'cascade' }),

    itemKey: varchar('item_key', { length: 128 }).notNull(),
    sectionKey: varchar('section_key', { length: 128 }).notNull(),

    // Copied from template for auditability
    itemSnapshot: jsonb('item_snapshot').$type<Record<string, unknown>>().notNull().default({}),

    value: inspectionResponseValueEnum('value'),
    numericValue: numeric('numeric_value', { precision: 12, scale: 4 }),
    textValue: text('text_value'),

    isCritical: boolean('is_critical').notNull().default(false),
    isPass: boolean('is_pass'),
    // Weighted contribution used by scoring
    score: numeric('score', { precision: 6, scale: 3 }),

    note: text('note'),
    respondedByUserId: uuid('responded_by_user_id'),
    respondedAt: timestamps.createdAt,

    ...timestamps,
  },
  (t) => [
    index('inspection_responses_inspection_idx').on(t.inspectionId),
    index('inspection_responses_company_idx').on(t.companyId),
    uniqueIndex('inspection_responses_uidx').on(t.inspectionId, t.itemKey),
  ],
);

export type InspectionResponse = typeof inspectionResponses.$inferSelect;
export type NewInspectionResponse = typeof inspectionResponses.$inferInsert;
