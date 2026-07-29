import { index, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { auditActionEnum } from './enums.js';
import { companies } from './companies.js';

// Immutable log of user actions. Append-only — no update/delete from app code.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id'),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),
    // Diff / metadata (what changed)
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    ...timestamps,
  },
  (t) => [
    index('audit_logs_company_idx').on(t.companyId),
    index('audit_logs_actor_idx').on(t.actorUserId),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
