import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { inspectionEventTypeEnum } from './enums.js';
import { companies } from './companies.js';
import { inspections } from './inspections.js';

/**
 * Immutable inspection timeline. Same shape as asset_events / task_events.
 * Every response/finding/status change appends a row.
 */
export const inspectionEvents = pgTable(
  'inspection_events',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id, { onDelete: 'cascade' }),

    eventType: inspectionEventTypeEnum('event_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    source: text('source').notNull().default('web'),

    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
    aiAnnotation: jsonb('ai_annotation').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('inspection_events_inspection_idx').on(t.inspectionId),
    index('inspection_events_company_idx').on(t.companyId),
    index('inspection_events_type_idx').on(t.companyId, t.eventType),
  ],
);

export type InspectionEvent = typeof inspectionEvents.$inferSelect;
export type NewInspectionEvent = typeof inspectionEvents.$inferInsert;
