import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { branchStatusEnum, restaurantTypeEnum } from './enums.js';
import { brands } from './brands.js';
import { companies } from './companies.js';

export const branches = pgTable(
  'branches',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 32 }).notNull(),
    nameAr: varchar('name_ar', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    // Drives auto-loading of matching HACCP / inspection templates
    restaurantType: restaurantTypeEnum('restaurant_type').notNull().default('other'),
    status: branchStatusEnum('status').notNull().default('active'),
    // Location
    city: varchar('city', { length: 128 }).notNull(),
    region: varchar('region', { length: 128 }),
    addressLine: text('address_line'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    // Licensing
    municipalityLicenseNumber: varchar('municipality_license_number', { length: 100 }),
    municipalityLicenseExpiryDate: varchar('municipality_license_expiry_date', { length: 10 }),
    // Ops
    seatingCapacity: integer('seating_capacity'),
    staffHeadcount: integer('staff_headcount'),
    openHours: jsonb('open_hours').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index('branches_company_idx').on(t.companyId),
    index('branches_brand_idx').on(t.brandId),
    index('branches_status_idx').on(t.status),
  ],
);

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
