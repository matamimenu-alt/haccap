import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import {
  polymorphicTargetTypeEnum,
  riskLevelEnum,
  taskKindEnum,
  taskPriorityEnum,
  taskSourceEnum,
  taskStatusEnum,
} from './enums.js';
import { areas } from './areas.js';
import { branches } from './branches.js';
import { companies } from './companies.js';
import { taskTemplates } from './task-templates.js';

/**
 * The concrete work item. Every task lives in exactly one branch and points
 * at a polymorphic target (an asset, an area, or the branch itself for
 * facility-wide work). Optional area for indoor scope.
 *
 * `checklist_state` is the runtime state of the checklist copied from the
 * template at materialization time. Keeping it inline on the task keeps
 * queries simple; the immutable transitions live in `task_events`.
 *
 * AI-readiness:
 *  - ai_summary       — LLM prompt-ready one-liner
 *  - ai_metadata      — feature bag: kind, priority, criticality, target refs
 *  - ai_risk_score    — Phase 8 predictions (nullable)
 *  - Every source_type has a matching source_id so an LLM can trace back
 */
export const tasks = pgTable(
  'tasks',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Physical scope
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),

    // Polymorphic target — what the task is against. Uses the shared
    // polymorphic_target_type enum so the same tool-use surface works
    // across tasks / attachments / (future) inspections.
    targetType: polymorphicTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    // Blueprint (nullable — ad-hoc tasks skip the template)
    templateId: uuid('template_id').references(() => taskTemplates.id, {
      onDelete: 'set null',
    }),

    // Provenance
    source: taskSourceEnum('source').notNull().default('manual'),
    sourceId: uuid('source_id'), // e.g. maintenance_schedule.id, inspection.id, ccp_deviation.id

    // Identity + classification
    kind: taskKindEnum('kind').notNull().default('ad_hoc'),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),

    status: taskStatusEnum('status').notNull().default('open'),
    priority: taskPriorityEnum('priority').notNull().default('normal'),
    riskLevel: riskLevelEnum('risk_level').notNull().default('medium'),

    // Fast lookup for "assigned to me". A task can ALSO have multi-user
    // assignments in the task_assignments table; this column holds the
    // primary assignee for board rendering.
    primaryAssigneeUserId: uuid('primary_assignee_user_id'),
    // Role-based assignment (e.g. "any Branch Manager at RUH-01")
    assignedRoleKey: varchar('assigned_role_key', { length: 64 }),

    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    completedByUserId: uuid('completed_by_user_id'),
    verifiedByUserId: uuid('verified_by_user_id'),
    cancelReason: text('cancel_reason'),
    completionNotes: text('completion_notes'),

    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    actualDurationMinutes: integer('actual_duration_minutes'),

    // Runtime checklist state — { itemKey: { done, note, at, byUserId } }
    checklistState: jsonb('checklist_state')
      .$type<
        Record<
          string,
          { done: boolean; note?: string; at?: string; byUserId?: string; value?: unknown }
        >
      >()
      .notNull()
      .default({}),

    // Whether attached evidence satisfies the template's requirements
    requiredEvidenceMet: boolean('required_evidence_met').notNull().default(false),

    // AI-ready fields
    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    aiRiskScore: varchar('ai_risk_score', { length: 8 }),
    aiPredictedOverdue: boolean('ai_predicted_overdue').notNull().default(false),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('tasks_company_idx').on(t.companyId),
    index('tasks_branch_idx').on(t.branchId),
    index('tasks_area_idx').on(t.areaId),
    index('tasks_target_idx').on(t.targetType, t.targetId),
    index('tasks_status_idx').on(t.companyId, t.status),
    index('tasks_priority_idx').on(t.companyId, t.priority),
    index('tasks_due_idx').on(t.companyId, t.dueAt),
    index('tasks_primary_assignee_idx').on(t.primaryAssigneeUserId),
    index('tasks_source_idx').on(t.source, t.sourceId),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
