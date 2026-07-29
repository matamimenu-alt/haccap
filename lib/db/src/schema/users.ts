import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { localeEnum, userStatusEnum } from './enums.js';
import { companies } from './companies.js';
import { departments } from './departments.js';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    passwordHash: text('password_hash').notNull(),
    fullNameAr: varchar('full_name_ar', { length: 255 }).notNull(),
    fullNameEn: varchar('full_name_en', { length: 255 }).notNull(),
    avatarUrl: text('avatar_url'),
    preferredLocale: localeEnum('preferred_locale').notNull().default('ar'),
    status: userStatusEnum('status').notNull().default('active'),
    // Multi-branch access — a user can be assigned to N branches without a pivot
    branchIds: uuid('branch_ids').array().notNull().default([]),
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    orgLevelId: uuid('org_level_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Users are unique per company by email (a person can have accounts in different tenants)
    index('users_company_email_idx').on(t.companyId, t.email),
    index('users_company_status_idx').on(t.companyId, t.status),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
