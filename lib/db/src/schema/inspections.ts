import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { inspectionKindEnum, inspectionStatusEnum, polymorphicTargetTypeEnum } from './enums.js';
import { areas } from './areas.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { inspectionTemplates } from './inspection-templates.js';

/**
 * The inspection instance. Tied to a branch + polymorphic target
 * (asset/area/branch). References the template snapshot at start; the
 * template's `items` shape gets projected into `inspection_responses` rows.
 *
 * Once finalized:
 *  - status='finalized'
 *  - overall_score / passed computed from responses
 *  - findings frozen; further edits require explicit reopen
 */
export const inspections = pgTable(
  'inspections',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Scope
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
    targetType: polymorphicTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    templateId: uuid('template_id').references(() => inspectionTemplates.id, {
      onDelete: 'set null',
    }),
    // Template snapshot at start — inspection scoring uses this shape
    // regardless of later template edits, keeping historical inspections
    // reproducible.
    templateVersion: integer('template_version').notNull().default(1),
    templateSnapshot: jsonb('template_snapshot').$type<Record<string, unknown>>().notNull().default({}),

    kind: inspectionKindEnum('kind').notNull().default('internal_audit'),
    reference: varchar('reference', { length: 128 }),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),

    status: inspectionStatusEnum('status').notNull().default('scheduled'),

    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    inspectorUserId: uuid('inspector_user_id'),
    accompaniedByUserId: uuid('accompanied_by_user_id'),
    reviewerUserId: uuid('reviewer_user_id'),

    overallScore: numeric('overall_score', { precision: 5, scale: 2 }),
    overallPass: boolean('overall_pass'),
    criticalFailures: integer('critical_failures').notNull().default(0),
    majorFailures: integer('major_failures').notNull().default(0),
    minorFailures: integer('minor_failures').notNull().default(0),

    // Written by inspector on submit
    notes: text('notes'),
    // Set on finalize
    verdict: text('verdict'),

    // AI-ready fields
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    aiRiskScore: varchar('ai_risk_score', { length: 8 }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('inspections_company_idx').on(t.companyId),
    index('inspections_branch_idx').on(t.branchId),
    index('inspections_target_idx').on(t.targetType, t.targetId),
    index('inspections_status_idx').on(t.companyId, t.status),
    index('inspections_scheduled_idx').on(t.companyId, t.scheduledFor),
    index('inspections_template_idx').on(t.templateId),
  ],
);

export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;
