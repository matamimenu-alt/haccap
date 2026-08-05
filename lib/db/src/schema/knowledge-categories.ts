import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';

/**
 * Hierarchical taxonomy for knowledge articles (Food Safety → HACCP →
 * Cross-contamination, etc.). System defaults (companyId=NULL) + per-tenant
 * custom, mirroring the shape of asset_categories.
 */
export const knowledgeCategories = pgTable(
  'knowledge_categories',
  {
    id: primaryId(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),

    key: varchar('key', { length: 128 }).notNull(),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    description: text('description'),

    path: text('path').notNull(),
    depth: integer('depth').notNull().default(0),

    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    iconKey: varchar('icon_key', { length: 64 }),
    colorHex: varchar('color_hex', { length: 8 }),

    aiHints: jsonb('ai_hints').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('knowledge_categories_company_idx').on(t.companyId),
    index('knowledge_categories_parent_idx').on(t.parentId),
    uniqueIndex('knowledge_categories_key_uidx').on(t.companyId, t.key),
    index('knowledge_categories_path_idx').on(t.path),
  ],
);

export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type NewKnowledgeCategory = typeof knowledgeCategories.$inferInsert;
