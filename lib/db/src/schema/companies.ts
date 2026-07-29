import { index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companyStatusEnum, localeEnum } from './enums.js';

export const companies = pgTable(
  'companies',
  {
    id: primaryId(),
    // Public-facing slug used in URLs / subdomain routing
    slug: varchar('slug', { length: 63 }).notNull().unique(),
    nameAr: varchar('name_ar', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    commercialRegistration: varchar('commercial_registration', { length: 50 }),
    vatNumber: varchar('vat_number', { length: 50 }),
    country: varchar('country', { length: 2 }).notNull().default('SA'),
    defaultLocale: localeEnum('default_locale').notNull().default('ar'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Riyadh'),
    status: companyStatusEnum('status').notNull().default('trial'),
    logoUrl: text('logo_url'),
    // Feature flags per company (module toggles from the SRS)
    enabledModules: jsonb('enabled_modules').$type<string[]>().notNull().default([]),
    // Arbitrary settings blob (notification prefs, branding, etc.)
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ownerUserId: uuid('owner_user_id'),
    ...timestamps,
  },
  (t) => [index('companies_status_idx').on(t.status)],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
