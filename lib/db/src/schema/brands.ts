import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';

export const brands = pgTable(
  'brands',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    nameAr: varchar('name_ar', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 63 }).notNull(),
    logoUrl: text('logo_url'),
    description: text('description'),
    ...timestamps,
  },
  (t) => [index('brands_company_idx').on(t.companyId)],
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
