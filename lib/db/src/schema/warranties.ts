import { boolean, date, index, jsonb, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { warrantyTypeEnum } from './enums.js';
import { assets } from './assets.js';
import { companies } from './companies.js';
import { suppliers } from './suppliers.js';

/**
 * One or more warranties per asset. Multi-provider is legitimate:
 * - manufacturer default 1yr
 * - extended service contract 3yr from a different vendor
 * - insurance policy on catastrophic loss
 *
 * `ai_extracted` is a reserved bag populated by the Phase 8 OCR/extraction
 * pipeline when the warranty certificate is uploaded as an attachment.
 */
export const warranties = pgTable(
  'warranties',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    providerSupplierId: uuid('provider_supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),

    type: warrantyTypeEnum('type').notNull().default('manufacturer'),
    referenceNumber: varchar('reference_number', { length: 128 }),
    coverageSummary: text('coverage_summary'),
    exclusions: text('exclusions'),
    termsText: text('terms_text'),

    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),

    // Financials
    cost: numeric('cost', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('SAR'),
    coverageLimit: numeric('coverage_limit', { precision: 14, scale: 2 }),

    // Renewal
    autoRenew: boolean('auto_renew').notNull().default(false),
    renewalReminderDaysBefore: numeric('renewal_reminder_days_before', { precision: 4, scale: 0 })
      .notNull()
      .default('30'),

    // AI extraction from uploaded certificate (Phase 8 populates)
    aiExtracted: jsonb('ai_extracted').$type<Record<string, unknown>>().notNull().default({}),

    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('warranties_asset_idx').on(t.assetId),
    index('warranties_company_idx').on(t.companyId),
    index('warranties_ends_idx').on(t.companyId, t.endsOn),
    index('warranties_provider_idx').on(t.providerSupplierId),
  ],
);

export type Warranty = typeof warranties.$inferSelect;
export type NewWarranty = typeof warranties.$inferInsert;
