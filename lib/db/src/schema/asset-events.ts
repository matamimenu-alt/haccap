import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { assetEventTypeEnum } from './enums.js';
import { assets } from './assets.js';
import { companies } from './companies.js';

/**
 * IMMUTABLE event log per asset. Append-only from application code.
 *
 * This table is the platform's source of truth for asset history AND the
 * AI training corpus for predictive maintenance, anomaly detection, and
 * timeline reconstruction. Because it is polymorphic-payload with a strict
 * `event_type` enum, an LLM tool-use loop can enumerate what events exist
 * and reason over them.
 *
 * Every row carries:
 *  - `event_type` — controlled enum, never a free string
 *  - `payload`    — { before?, after?, delta?, context? } — before/after
 *                   snapshots make the change machine-diffable
 *  - `actor_*`    — who triggered the event (nullable for system events)
 *  - `source`     — "web", "mobile", "system", "ai", "webhook", "cron"
 *  - `context`    — tenant-wide correlation bag (request_id, task_id, etc.)
 */
export const assetEvents = pgTable(
  'asset_events',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),

    eventType: assetEventTypeEnum('event_type').notNull(),

    actorUserId: uuid('actor_user_id'),
    source: text('source').notNull().default('web'),

    // Machine-diffable change record
    payload: jsonb('payload').$type<{
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      delta?: Record<string, unknown>;
      note?: string;
      [key: string]: unknown;
    }>().notNull().default({}),

    // Cross-entity correlation (task id, inspection id, request id, etc.)
    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),

    // AI annotation slot — populated by Phase 8 pipelines (severity classification,
    // pattern tag, root-cause hypothesis) — never populated by CRUD writes.
    aiAnnotation: jsonb('ai_annotation').$type<Record<string, unknown>>().notNull().default({}),

    ...timestamps,
  },
  (t) => [
    index('asset_events_asset_idx').on(t.assetId),
    index('asset_events_company_idx').on(t.companyId),
    index('asset_events_type_idx').on(t.companyId, t.eventType),
    index('asset_events_asset_created_idx').on(t.assetId, t.createdAt),
  ],
);

export type AssetEvent = typeof assetEvents.$inferSelect;
export type NewAssetEvent = typeof assetEvents.$inferInsert;
