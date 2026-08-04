import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { riskLevelEnum, taskKindEnum, taskPriorityEnum } from './enums.js';
import { companies } from './companies.js';

/**
 * Reusable task blueprint. A maintenance_schedule, an inspection template,
 * or an ad-hoc "add sanitizer" workflow can all reference a template.
 *
 * `checklist_items` is a structured array of steps that get materialized into
 * the task's `checklist_state` on creation. `required_attachments` declares
 * what evidence must be uploaded before the task can transition to
 * `in_review` or `completed`.
 */
export const taskTemplates = pgTable(
  'task_templates',
  {
    id: primaryId(),
    // NULL company_id = system template shared across tenants (rare in Phase 3;
    // used by later phases for regulatory templates)
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),

    key: varchar('key', { length: 128 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),

    kind: taskKindEnum('kind').notNull().default('maintenance'),
    defaultPriority: taskPriorityEnum('default_priority').notNull().default('normal'),
    defaultRisk: riskLevelEnum('default_risk').notNull().default('medium'),

    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    requiresEvidence: boolean('requires_evidence').notNull().default(false),
    requiresSignature: boolean('requires_signature').notNull().default(false),
    requiresVerification: boolean('requires_verification').notNull().default(false),

    // [{ key, labelAr, labelEn, required, type: 'checkbox'|'number'|'text' }]
    checklistItems: jsonb('checklist_items')
      .$type<Array<{ key: string; labelAr: string; labelEn: string; required: boolean; type: string }>>()
      .notNull()
      .default([]),

    // [{ kind: 'photo'|'document', minCount, labelAr, labelEn }]
    requiredAttachments: jsonb('required_attachments')
      .$type<Array<{ kind: string; minCount: number; labelAr: string; labelEn: string }>>()
      .notNull()
      .default([]),

    // Structured instructions bag — safety notes, parts list, PPE, references
    playbook: jsonb('playbook').$type<Record<string, unknown>>().notNull().default({}),

    // AI-consumable hints for LLM prompt construction on downstream ranking
    aiHints: jsonb('ai_hints').$type<Record<string, unknown>>().notNull().default({}),

    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('task_templates_company_idx').on(t.companyId),
    uniqueIndex('task_templates_key_uidx').on(t.companyId, t.key),
    index('task_templates_kind_idx').on(t.companyId, t.kind),
  ],
);

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
