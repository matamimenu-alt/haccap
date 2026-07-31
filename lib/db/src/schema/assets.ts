import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, timestamps } from './_shared.js';
import {
  assetCriticalityEnum,
  assetKindEnum,
  assetStatusEnum,
  riskLevelEnum,
} from './enums.js';
import { areas } from './areas.js';
import { assetCategories } from './asset-categories.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { suppliers } from './suppliers.js';

/**
 * The ROOT entity of the platform. Every downstream module (tasks,
 * inspections, HACCP CCPs, sensor telemetry, incidents) references this table.
 *
 * Multi-tenant scope: `company_id`. Physical scope: `branch_id` + `area_id`.
 * Semantic scope: `category_id` (from the asset_categories taxonomy).
 *
 * AI-readiness:
 *  - `search_vector`  — tsvector column for FTS (populated by a trigger or app-side)
 *  - `ai_summary`     — human-readable one-liner for LLM prompts
 *  - `ai_metadata`    — machine-readable feature blob (temperature range,
 *                       failure modes, expected sensor readings, etc.)
 *  - `embedding`      — reserved for pgvector; nullable, no dimension until
 *                       the extension is enabled (Phase 8 turns this on)
 *  - `metadata`       — free-form tenant-extensible bag
 *  - `spec`           — structured specification key/value (voltage, capacity)
 */
export const assets = pgTable(
  'assets',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Physical placement
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),

    // Taxonomy
    categoryId: uuid('category_id').references(() => assetCategories.id, {
      onDelete: 'set null',
    }),
    kind: assetKindEnum('kind').notNull().default('equipment'),

    // Identity — code is the human-visible short id shown on the QR label
    code: varchar('code', { length: 64 }).notNull(),
    nameAr: varchar('name_ar', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    description: text('description'),

    // Physical identifiers
    manufacturer: varchar('manufacturer', { length: 128 }),
    model: varchar('model', { length: 128 }),
    serialNumber: varchar('serial_number', { length: 128 }),
    barcode: varchar('barcode', { length: 128 }),

    // Structured specification (rendered from category.suggestedSpecs + overrides)
    spec: jsonb('spec').$type<Record<string, string | number | boolean | null>>().notNull().default({}),

    // Lifecycle
    status: assetStatusEnum('status').notNull().default('operational'),
    criticality: assetCriticalityEnum('criticality').notNull().default('medium'),
    riskLevel: riskLevelEnum('risk_level').notNull().default('low'),

    // Acquisition
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    purchaseDate: date('purchase_date'),
    purchaseCost: numeric('purchase_cost', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('SAR'),
    installedDate: date('installed_date'),

    // Depreciation / useful life
    expectedLifespanMonths: integer('expected_lifespan_months'),
    decommissionedAt: timestamps.createdAt,
    decommissionReason: text('decommission_reason'),

    // Operational stats — updated by the task/service loop later
    lastServicedAt: timestamps.createdAt,
    nextServiceDueAt: timestamps.createdAt,

    // AI-ready fields
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    // Reserved for pgvector. Left as text with a comment — activated by
    // the Phase 8 migration that CREATE EXTENSION vector and alters this column.
    // Kept nullable to avoid affecting current queries.
    embeddingRef: text('embedding_ref'),

    // Full-text search vector — populated by app code on write. Kept as text
    // for portability across Postgres versions; a later migration can convert
    // to tsvector and add a GIN index.
    searchText: text('search_text').notNull().default(''),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('assets_company_idx').on(t.companyId),
    index('assets_branch_idx').on(t.branchId),
    index('assets_area_idx').on(t.areaId),
    index('assets_category_idx').on(t.categoryId),
    index('assets_status_idx').on(t.companyId, t.status),
    index('assets_criticality_idx').on(t.companyId, t.criticality),
    index('assets_supplier_idx').on(t.supplierId),
    // Code uniqueness per company
    uniqueIndex('assets_company_code_uidx').on(t.companyId, t.code).where(sql`deleted_at IS NULL`),
  ],
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
