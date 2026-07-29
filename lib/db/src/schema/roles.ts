import { boolean, index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { users } from './users.js';

// 10 system roles per SRS (Super Admin → Employee). Companies on the
// enterprise tier can also define custom roles.
export const roles = pgTable(
  'roles',
  {
    id: primaryId(),
    // System roles have companyId = null and are shared across tenants
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    nameAr: varchar('name_ar', { length: 128 }).notNull(),
    nameEn: varchar('name_en', { length: 128 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    // Lower = more privileged; used to prevent lower-priv users from managing higher ones
    priority: varchar('priority', { length: 8 }).notNull().default('99'),
    ...timestamps,
  },
  (t) => [
    index('roles_company_idx').on(t.companyId),
    index('roles_key_idx').on(t.companyId, t.key),
  ],
);

// User <-> Role many-to-many. A user can hold multiple roles (e.g. Food Safety Officer
// + Branch Manager at a small chain).
export const userRoles = pgTable(
  'user_roles',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('user_roles_user_idx').on(t.userId),
    index('user_roles_role_idx').on(t.roleId),
    index('user_roles_company_idx').on(t.companyId),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
