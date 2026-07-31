import { index, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { assets } from './assets.js';
import { companies } from './companies.js';

/**
 * Tenant-defined tag catalog (e.g., "high-value", "leased", "grant-funded").
 * Kept intentionally simple — one label + one color per tag.
 */
export const assetTags = pgTable(
  'asset_tags',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    labelAr: varchar('label_ar', { length: 64 }).notNull(),
    labelEn: varchar('label_en', { length: 64 }).notNull(),
    colorHex: varchar('color_hex', { length: 8 }),
    ...timestamps,
  },
  (t) => [
    index('asset_tags_company_idx').on(t.companyId),
    uniqueIndex('asset_tags_key_uidx').on(t.companyId, t.key),
  ],
);

export const assetTagAssignments = pgTable(
  'asset_tag_assignments',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => assetTags.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('asset_tag_assignments_uidx').on(t.assetId, t.tagId),
    index('asset_tag_assignments_tag_idx').on(t.tagId),
  ],
);

export type AssetTag = typeof assetTags.$inferSelect;
export type NewAssetTag = typeof assetTags.$inferInsert;
export type AssetTagAssignment = typeof assetTagAssignments.$inferSelect;
