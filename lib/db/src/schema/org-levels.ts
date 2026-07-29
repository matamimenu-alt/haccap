import { index, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';

// Dynamic org hierarchy — companies define their own depth (from Ownership
// down to Employee). Small chains collapse to Branch Manager → Employees.
export const orgLevels = pgTable(
  'org_levels',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    depth: integer('depth').notNull(),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    parentLevelId: uuid('parent_level_id'),
    ...timestamps,
  },
  (t) => [
    index('org_levels_company_idx').on(t.companyId),
    index('org_levels_depth_idx').on(t.companyId, t.depth),
  ],
);

export type OrgLevel = typeof orgLevels.$inferSelect;
export type NewOrgLevel = typeof orgLevels.$inferInsert;
