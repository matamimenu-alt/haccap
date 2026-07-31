import { boolean, index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { assetKindEnum, riskLevelEnum } from './enums.js';
import { companies } from './companies.js';

/**
 * Hierarchical taxonomy for assets. Path is materialized in `path_ltree`
 * (stored as text — pgltree extension optional) so subtree queries are O(1).
 *
 * companyId=NULL rows are system categories seeded once; per-tenant categories
 * carry a companyId and can extend the tree with custom children.
 *
 * `ai_hints` is a structured hint bag the AI engine reads to reason about
 * likely failure modes, sensor telemetry expected, inspection checklists, etc.
 * Example: { failureModes: ['compressor', 'seal'], monitors: ['temp'], … }
 */
export const assetCategories = pgTable(
  'asset_categories',
  {
    id: primaryId(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),

    // Machine key like "refrigeration.walk_in_cooler" — stable across renames
    key: varchar('key', { length: 128 }).notNull(),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    description: text('description'),

    // Materialized ancestry path e.g. "refrigeration/walk_in_cooler/reach_in"
    path: text('path').notNull(),
    depth: integer('depth').notNull().default(0),

    // The default asset-kind for members of this category (a reach-in fridge is
    // equipment; a walk-in cooler shell is a facility). Overridable per asset.
    defaultAssetKind: assetKindEnum('default_asset_kind').notNull().default('equipment'),

    // Baseline risk / criticality suggestion for members
    riskLevel: riskLevelEnum('risk_level').notNull().default('low'),

    // Suggested attributes an asset in this category should record (used to
    // build the "specs" tab of the asset detail page dynamically).
    suggestedSpecs: jsonb('suggested_specs')
      .$type<Array<{ key: string; label: { ar: string; en: string }; type: string; unit?: string }>>()
      .notNull()
      .default([]),

    // AI hint bag — see file header
    aiHints: jsonb('ai_hints').$type<Record<string, unknown>>().notNull().default({}),

    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    iconKey: varchar('icon_key', { length: 64 }),
    colorHex: varchar('color_hex', { length: 8 }),
    ...timestamps,
  },
  (t) => [
    index('asset_categories_company_idx').on(t.companyId),
    index('asset_categories_parent_idx').on(t.parentId),
    index('asset_categories_key_idx').on(t.companyId, t.key),
    index('asset_categories_path_idx').on(t.path),
  ],
);

export type AssetCategory = typeof assetCategories.$inferSelect;
export type NewAssetCategory = typeof assetCategories.$inferInsert;
