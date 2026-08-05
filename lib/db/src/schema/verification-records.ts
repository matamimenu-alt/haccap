import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { verificationKindEnum } from './enums.js';
import { ccps } from './ccps.js';
import { companies } from './companies.js';
import { haccpPlans } from './haccp-plans.js';

/**
 * Records that a verification activity took place — HACCP Principle 6.
 * A verification can be tied to a plan (annual review) or a specific CCP
 * (calibration + record review).
 */
export const verificationRecords = pgTable(
  'verification_records',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    haccpPlanId: uuid('haccp_plan_id').references(() => haccpPlans.id, { onDelete: 'cascade' }),
    ccpId: uuid('ccp_id').references(() => ccps.id, { onDelete: 'cascade' }),

    kind: verificationKindEnum('kind').notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    performedByUserId: uuid('performed_by_user_id'),

    outcome: text('outcome'),
    isEffective: boolean('is_effective').notNull().default(true),
    findingsSummary: text('findings_summary'),
    nextDueOn: timestamp('next_due_on', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('verification_records_plan_idx').on(t.haccpPlanId),
    index('verification_records_ccp_idx').on(t.ccpId),
    index('verification_records_company_idx').on(t.companyId),
    index('verification_records_next_idx').on(t.companyId, t.nextDueOn),
  ],
);

export type VerificationRecord = typeof verificationRecords.$inferSelect;
export type NewVerificationRecord = typeof verificationRecords.$inferInsert;
