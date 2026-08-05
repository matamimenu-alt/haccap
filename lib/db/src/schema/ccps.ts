import { boolean, index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { hazardStageEnum } from './enums.js';
import { assets } from './assets.js';
import { companies } from './companies.js';
import { haccpPlans } from './haccp-plans.js';

/**
 * Critical Control Point. Bound to a HACCP plan and (usually) an asset
 * (fridge, oven, shawarma machine). Carries structured critical limits +
 * monitoring cadence + corrective-action playbook.
 *
 * `criticalLimits` shape:
 *   [{ metric: 'core_temp_c', op: 'gte'|'lte'|'between', value?, min?, max?, unit? }]
 *
 * `monitoring` shape:
 *   { frequency: 'per_batch'|'hourly'|'daily'|'weekly', method: 'probe'|'visual'|..., responsible: 'role_key' }
 */
export const ccps = pgTable(
  'ccps',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    haccpPlanId: uuid('haccp_plan_id')
      .notNull()
      .references(() => haccpPlans.id, { onDelete: 'cascade' }),

    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),

    reference: varchar('reference', { length: 32 }).notNull(),
    number: integer('number').notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    stage: hazardStageEnum('stage').notNull(),
    description: text('description'),

    // Hazards this CCP controls
    hazardIds: uuid('hazard_ids').array().notNull().default([]),

    criticalLimits: jsonb('critical_limits')
      .$type<Array<{
        metric: string;
        op: 'gte' | 'lte' | 'between' | 'eq';
        value?: number;
        min?: number;
        max?: number;
        unit?: string;
        labelEn?: string;
        labelAr?: string;
      }>>()
      .notNull()
      .default([]),

    monitoring: jsonb('monitoring').$type<{
      frequency: string;
      method: string;
      responsibleRoleKey?: string;
      procedureRef?: string; // knowledge article key
    }>().notNull().default({ frequency: 'daily', method: 'probe' }),

    correctiveActionPlaybook: jsonb('corrective_action_playbook')
      .$type<Array<{ step: string; ownerRoleKey?: string; deadlineMinutes?: number }>>()
      .notNull()
      .default([]),

    verificationPlan: jsonb('verification_plan').$type<{
      frequency?: string;
      method?: string;
      recordType?: string;
    }>().notNull().default({}),

    isActive: boolean('is_active').notNull().default(true),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('ccps_plan_idx').on(t.haccpPlanId),
    index('ccps_asset_idx').on(t.assetId),
    index('ccps_company_idx').on(t.companyId),
  ],
);

export type Ccp = typeof ccps.$inferSelect;
export type NewCcp = typeof ccps.$inferInsert;
