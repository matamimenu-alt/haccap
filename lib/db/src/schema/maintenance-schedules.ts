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
import { maintenanceFrequencyEnum, maintenanceKindEnum, riskLevelEnum } from './enums.js';
import { assets } from './assets.js';
import { assetCategories } from './asset-categories.js';
import { companies } from './companies.js';

/**
 * Recurring maintenance plan. Can target a specific asset OR a category
 * (applies to every asset in that category subtree). The Phase 3 Task Engine
 * subscribes to these — on each `next_due_at`, it materializes a task.
 *
 * `rrule` follows RFC 5545 (iCal). We store both the machine RRULE and a
 * structured frequency for fast filtering. Advanced schedules (usage_based,
 * condition_based) use the metadata bag for their triggers.
 *
 * AI-ready: `predicted_failure_score` / `predicted_next_failure_at` are
 * nullable predictions that the Phase 8 engine writes back.
 */
export const maintenanceSchedules = pgTable(
  'maintenance_schedules',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Target — exactly one of assetId or categoryId is expected
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => assetCategories.id, {
      onDelete: 'cascade',
    }),

    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    description: text('description'),

    kind: maintenanceKindEnum('kind').notNull().default('preventive'),
    frequency: maintenanceFrequencyEnum('frequency').notNull().default('monthly'),
    rrule: text('rrule'),
    intervalCount: integer('interval_count').notNull().default(1),
    riskIfSkipped: riskLevelEnum('risk_if_skipped').notNull().default('medium'),

    // Anchor + generation
    startsOn: timestamp('starts_on', { withTimezone: true }).notNull(),
    endsOn: timestamp('ends_on', { withTimezone: true }),
    nextDueAt: timestamp('next_due_at', { withTimezone: true }),
    lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),

    // Duration + effort hints (used by the task engine to size a task)
    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    requiresShutdown: boolean('requires_shutdown').notNull().default(false),

    // Instructions bag — checklist steps, parts needed, safety notes
    playbook: jsonb('playbook').$type<Record<string, unknown>>().notNull().default({}),

    // AI predictions (Phase 8 populates)
    predictedFailureScore: varchar('predicted_failure_score', { length: 8 }),
    predictedNextFailureAt: timestamp('predicted_next_failure_at', { withTimezone: true }),

    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('maintenance_schedules_company_idx').on(t.companyId),
    index('maintenance_schedules_asset_idx').on(t.assetId),
    index('maintenance_schedules_category_idx').on(t.categoryId),
    index('maintenance_schedules_due_idx').on(t.companyId, t.nextDueAt),
    index('maintenance_schedules_active_idx').on(t.companyId, t.isActive),
  ],
);

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type NewMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;
