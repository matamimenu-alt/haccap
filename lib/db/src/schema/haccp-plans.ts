import { boolean, date, index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { haccpPlanStatusEnum } from './enums.js';
import { branches } from './branches.js';
import { companies } from './companies.js';

/**
 * A HACCP plan. One tenant can hold many (one per product line, per branch,
 * or one master plan). Follows Codex Alimentarius CAC/RCP 1-1969.
 *
 * `scopeProducts` and `scopeProcesses` are structured jsonb (LLM-consumable).
 * `teamMembers` captures the HACCP team roster (name + role + responsibilities).
 */
export const haccpPlans = pgTable(
  'haccp_plans',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Optionally branch-scoped (null = company-wide master plan)
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),

    reference: varchar('reference', { length: 64 }).notNull(),
    version: integer('version').notNull().default(1),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),
    productDescription: text('product_description'),
    intendedUse: text('intended_use'),

    status: haccpPlanStatusEnum('status').notNull().default('draft'),

    approvedByUserId: uuid('approved_by_user_id'),
    approvedAt: date('approved_at'),
    effectiveFrom: date('effective_from'),
    reviewDueOn: date('review_due_on'),

    scopeProducts: jsonb('scope_products').$type<Array<{ nameEn: string; nameAr?: string; category?: string }>>().notNull().default([]),
    scopeProcesses: jsonb('scope_processes').$type<string[]>().notNull().default([]),
    teamMembers: jsonb('team_members')
      .$type<Array<{ userId?: string; name: string; role: string; responsibilities?: string[] }>>()
      .notNull()
      .default([]),

    // Prerequisite programs referenced (SSOP, GMP, GHP, cleaning, pest control)
    prerequisitePrograms: jsonb('prerequisite_programs').$type<string[]>().notNull().default([]),

    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),

    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('haccp_plans_company_idx').on(t.companyId),
    index('haccp_plans_branch_idx').on(t.branchId),
    index('haccp_plans_status_idx').on(t.companyId, t.status),
    index('haccp_plans_reference_idx').on(t.companyId, t.reference),
  ],
);

export type HaccpPlan = typeof haccpPlans.$inferSelect;
export type NewHaccpPlan = typeof haccpPlans.$inferInsert;
