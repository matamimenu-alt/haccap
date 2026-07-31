import { boolean, index, jsonb, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';

/**
 * Supplier / vendor / service provider. Used for:
 *  - Asset acquisition source
 *  - Warranty provider
 *  - Maintenance service contractor
 *  - Municipality-approved vendor tracking
 *
 * `categories` is a tag-like array of business categories they serve
 * (equipment, pest_control, cleaning_chemicals, etc.) — enables filtering
 * without a rigid taxonomy.
 */
export const suppliers = pgTable(
  'suppliers',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    code: varchar('code', { length: 32 }),
    nameAr: varchar('name_ar', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),

    commercialRegistration: varchar('commercial_registration', { length: 50 }),
    vatNumber: varchar('vat_number', { length: 50 }),

    // Contact channel of record
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    website: varchar('website', { length: 255 }),

    // Address
    country: varchar('country', { length: 2 }).notNull().default('SA'),
    city: varchar('city', { length: 128 }),
    addressLine: text('address_line'),

    // Business categories (free-tag style)
    categories: text('categories').array().notNull().default([]),

    // Ratings / performance metrics — populated by later phases, kept here
    // so callers don't do joins for a supplier card.
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }),
    ratingCount: numeric('rating_count', { precision: 10, scale: 0 }).notNull().default('0'),

    // Approvals: municipality, SFDA, ISO, HACCP-certified vendors get flags here
    approvals: jsonb('approvals').$type<Record<string, { certifiedAt?: string; expiresAt?: string; ref?: string }>>().notNull().default({}),

    // AI-consumable
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),

    isActive: boolean('is_active').notNull().default(true),
    isPreferred: boolean('is_preferred').notNull().default(false),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('suppliers_company_idx').on(t.companyId),
    index('suppliers_active_idx').on(t.companyId, t.isActive),
    index('suppliers_preferred_idx').on(t.companyId, t.isPreferred),
  ],
);

export const supplierContacts = pgTable(
  'supplier_contacts',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    title: varchar('title', { length: 128 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('supplier_contacts_supplier_idx').on(t.supplierId),
    index('supplier_contacts_company_idx').on(t.companyId),
  ],
);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplierContact = typeof supplierContacts.$inferSelect;
export type NewSupplierContact = typeof supplierContacts.$inferInsert;
