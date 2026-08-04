import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { inspectionKindEnum } from './enums.js';
import { companies } from './companies.js';

/**
 * Inspection template — the graded checklist. Sections + items are stored
 * inline as jsonb because they're template *configuration* (change with the
 * template, versioned by cloning) rather than runtime data. Each finalized
 * inspection copies the item shape into `inspection_responses` rows so the
 * response history stays queryable and independent of later template edits.
 *
 * Scoring model:
 *   sum(response_score × item_weight) / sum(item_weight)  — per section,
 *   then aggregated as sum(section_score × section_weight) / sum(section_weight).
 *
 * items[i] = {
 *   key, sectionKey, labelAr, labelEn,
 *   type: 'yesno' | 'scale5' | 'numeric' | 'text',
 *   weight: number (default 1),
 *   critical: boolean (a fail here forces a critical finding),
 *   allowNA: boolean,
 *   evidenceRequiredOnFail: boolean,
 *   passIf?: { op: 'gte'|'lte'|'between', value?, min?, max? },  // for numeric
 * }
 */
export const inspectionTemplates = pgTable(
  'inspection_templates',
  {
    id: primaryId(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),

    key: varchar('key', { length: 128 }).notNull(),
    version: integer('version').notNull().default(1),

    kind: inspectionKindEnum('kind').notNull().default('internal_audit'),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),

    // Which authority owns this checklist. Free-form so companies can add
    // their own (e.g. "Riyadh Municipality", "SFDA", "Internal QA").
    issuingAuthority: varchar('issuing_authority', { length: 128 }),
    // Regulatory reference (article number, standard code)
    regulatoryRef: varchar('regulatory_ref', { length: 128 }),

    // Passing threshold as percentage 0-100. Below this = fail overall.
    passThreshold: integer('pass_threshold').notNull().default(80),

    // sections[i] = { key, labelAr, labelEn, weight?, order? }
    sections: jsonb('sections')
      .$type<Array<{ key: string; labelAr: string; labelEn: string; weight?: number; order?: number }>>()
      .notNull()
      .default([]),

    // items — see file header for shape
    items: jsonb('items')
      .$type<Array<{
        key: string;
        sectionKey: string;
        labelAr: string;
        labelEn: string;
        type: 'yesno' | 'scale5' | 'numeric' | 'text';
        weight?: number;
        critical?: boolean;
        allowNA?: boolean;
        evidenceRequiredOnFail?: boolean;
        passIf?: { op: 'gte' | 'lte' | 'between'; value?: number; min?: number; max?: number };
        unit?: string;
      }>>()
      .notNull()
      .default([]),

    // What target types this template can be run against (asset/area/branch)
    scopeTargets: jsonb('scope_targets').$type<string[]>().notNull().default(['branch']),

    // AI hints for downstream ranking (e.g. compliance frameworks touched)
    aiHints: jsonb('ai_hints').$type<Record<string, unknown>>().notNull().default({}),

    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('inspection_templates_company_idx').on(t.companyId),
    uniqueIndex('inspection_templates_key_version_uidx').on(t.companyId, t.key, t.version),
    index('inspection_templates_kind_idx').on(t.companyId, t.kind),
  ],
);

export type InspectionTemplate = typeof inspectionTemplates.$inferSelect;
export type NewInspectionTemplate = typeof inspectionTemplates.$inferInsert;
