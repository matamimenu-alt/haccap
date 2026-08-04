import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { findingSeverityEnum, findingStatusEnum, polymorphicTargetTypeEnum } from './enums.js';
import { companies } from './companies.js';
import { inspections } from './inspections.js';

/**
 * A finding is a failed / observed item that needs follow-up. Sourced from
 * inspections in Phase 4; Phase 6 (HACCP) can also create findings from CCP
 * deviations, and Phase 7 (Municipality) creates them from violations.
 *
 * Findings auto-spawn tasks (kind='inspection_followup' or 'capa_action')
 * so the ops team sees them on their board without a separate CAPA screen
 * having to be built yet.
 */
export const findings = pgTable(
  'findings',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Provenance — nullable so Phase 6/7 can attach without inspection scope
    inspectionId: uuid('inspection_id').references(() => inspections.id, {
      onDelete: 'cascade',
    }),
    inspectionResponseId: uuid('inspection_response_id'),

    // Physical scope
    branchId: uuid('branch_id'),
    areaId: uuid('area_id'),
    targetType: polymorphicTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    reference: varchar('reference', { length: 64 }),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),
    regulatoryRef: varchar('regulatory_ref', { length: 128 }),

    severity: findingSeverityEnum('severity').notNull().default('minor'),
    status: findingStatusEnum('status').notNull().default('open'),

    // Follow-up task auto-created for the finding
    followupTaskId: uuid('followup_task_id'),

    // Corrective + preventive actions (populated by users; Phase 6 could
    // formalize into a capa_actions table if the scope grows).
    correctiveAction: text('corrective_action'),
    preventiveAction: text('preventive_action'),

    dueAt: timestamp('due_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id'),
    resolutionNotes: text('resolution_notes'),

    // AI-ready
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('findings_company_idx').on(t.companyId),
    index('findings_inspection_idx').on(t.inspectionId),
    index('findings_target_idx').on(t.targetType, t.targetId),
    index('findings_status_idx').on(t.companyId, t.status),
    index('findings_severity_idx').on(t.companyId, t.severity),
    index('findings_due_idx').on(t.companyId, t.dueAt),
  ],
);

export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
