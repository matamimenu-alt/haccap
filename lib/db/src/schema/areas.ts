import { boolean, index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { areaKindEnum, riskLevelEnum } from './enums.js';
import { branches } from './branches.js';
import { companies } from './companies.js';

/**
 * Areas are functional zones inside a branch (kitchen, walk-in cooler, prep
 * line, dishwash, dining, dry storage, etc.). Every asset is placed in exactly
 * one area — this scope is what inspections, HACCP, and sensor telemetry key
 * off downstream.
 *
 * Hierarchical: an "Kitchen" area can have child areas like "Grill Station"
 * and "Fry Station". `parent_area_id` is a self-ref (no FK constraint here —
 * enforced at the app layer, allows soft-delete without cascade surprises).
 */
export const areas = pgTable(
  'areas',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    parentAreaId: uuid('parent_area_id'),

    code: varchar('code', { length: 32 }).notNull(),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    kind: areaKindEnum('kind').notNull().default('other'),
    description: text('description'),

    // Compliance scope — a cold room needs temperature monitoring, a dry store
    // needs pest control, etc. Downstream modules consult this.
    riskLevel: riskLevelEnum('risk_level').notNull().default('low'),
    complianceScope: jsonb('compliance_scope').$type<string[]>().notNull().default([]),

    // Environmental targets (temperature range, humidity) used by HACCP/food-safety.
    // Nullable — only relevant for storage/cold areas.
    targetTempMinC: varchar('target_temp_min_c', { length: 8 }),
    targetTempMaxC: varchar('target_temp_max_c', { length: 8 }),
    targetHumidityPct: varchar('target_humidity_pct', { length: 8 }),

    // AI-consumable summary + machine-readable feature blob
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),

    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('areas_company_idx').on(t.companyId),
    index('areas_branch_idx').on(t.branchId),
    index('areas_kind_idx').on(t.branchId, t.kind),
    index('areas_parent_idx').on(t.parentAreaId),
  ],
);

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
