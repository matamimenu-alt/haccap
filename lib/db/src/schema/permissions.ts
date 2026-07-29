import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { roles } from './roles.js';

// Permission catalog is global — the same {module}:{action} strings across tenants.
export const permissions = pgTable(
  'permissions',
  {
    id: primaryId(),
    // module:action, e.g. "inspections:create", "haccp:approve"
    key: varchar('key', { length: 128 }).notNull().unique(),
    module: varchar('module', { length: 64 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    ...timestamps,
  },
  (t) => [index('permissions_module_idx').on(t.module)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: primaryId(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('role_permissions_role_idx').on(t.roleId),
    index('role_permissions_perm_idx').on(t.permissionId),
  ],
);

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
