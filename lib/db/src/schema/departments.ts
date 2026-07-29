import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';

export const departments = pgTable(
  'departments',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    code: varchar('code', { length: 32 }),
    ...timestamps,
  },
  (t) => [index('departments_company_idx').on(t.companyId)],
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
