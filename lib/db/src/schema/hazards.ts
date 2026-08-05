import { boolean, index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { hazardStageEnum, hazardTypeEnum } from './enums.js';
import { companies } from './companies.js';
import { haccpPlans } from './haccp-plans.js';

/**
 * Hazard analysis entry. Each hazard is scored on severity × likelihood
 * → risk_score, which drives whether the hazard becomes a CCP.
 *
 * severity 1-5, likelihood 1-5, riskScore = severity × likelihood (1-25).
 * significantIfScore ≥ 8 by convention (configurable per plan).
 */
export const hazards = pgTable(
  'hazards',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    haccpPlanId: uuid('haccp_plan_id')
      .notNull()
      .references(() => haccpPlans.id, { onDelete: 'cascade' }),

    // Optional link to a plan step (see haccp_plan_steps)
    planStepId: uuid('plan_step_id'),

    reference: varchar('reference', { length: 32 }),
    type: hazardTypeEnum('type').notNull(),
    stage: hazardStageEnum('stage').notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),
    // e.g. Salmonella, Listeria, cleaning residue, metal fragment
    agent: varchar('agent', { length: 128 }),

    severity: integer('severity').notNull().default(3),
    likelihood: integer('likelihood').notNull().default(3),
    riskScore: integer('risk_score').notNull().default(9),
    isSignificant: boolean('is_significant').notNull().default(false),
    justification: text('justification'),

    preventiveMeasures: jsonb('preventive_measures').$type<string[]>().notNull().default([]),
    controlMeasures: jsonb('control_measures').$type<string[]>().notNull().default([]),

    // Set to true when the hazard is controlled at a CCP (see ccps.hazard_ids)
    isCcp: boolean('is_ccp').notNull().default(false),

    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('hazards_plan_idx').on(t.haccpPlanId),
    index('hazards_company_idx').on(t.companyId),
    index('hazards_type_idx').on(t.companyId, t.type),
    index('hazards_stage_idx').on(t.haccpPlanId, t.stage),
  ],
);

export type Hazard = typeof hazards.$inferSelect;
export type NewHazard = typeof hazards.$inferInsert;
