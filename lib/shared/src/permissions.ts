// Catalog of permission keys (module:action). Kept short for Phase 1 — later
// phases append entries for inspections, haccp, tasks, capa, ai, reports, etc.
export const PERMISSIONS = {
  // Organization
  companies_read:   { key: 'companies:read',   module: 'organization', action: 'read' },
  companies_write:  { key: 'companies:write',  module: 'organization', action: 'write' },
  brands_read:      { key: 'brands:read',      module: 'organization', action: 'read' },
  brands_write:     { key: 'brands:write',     module: 'organization', action: 'write' },
  branches_read:    { key: 'branches:read',    module: 'organization', action: 'read' },
  branches_write:   { key: 'branches:write',   module: 'organization', action: 'write' },
  org_levels_write: { key: 'org_levels:write', module: 'organization', action: 'write' },
  departments_write:{ key: 'departments:write',module: 'organization', action: 'write' },

  // Users & RBAC
  users_read:       { key: 'users:read',       module: 'users', action: 'read' },
  users_write:      { key: 'users:write',      module: 'users', action: 'write' },
  roles_read:       { key: 'roles:read',       module: 'users', action: 'read' },
  roles_write:      { key: 'roles:write',      module: 'users', action: 'write' },

  // Audit
  audit_read:       { key: 'audit:read',       module: 'audit', action: 'read' },
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['key'];

// Default role → permission mapping used at seed time. Only Phase 1 entries.
export const ROLE_DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  platform_super_admin: Object.values(PERMISSIONS).map((p) => p.key),
  company_owner: Object.values(PERMISSIONS).map((p) => p.key),
  operations_director: [
    'companies:read', 'brands:read', 'brands:write',
    'branches:read', 'branches:write',
    'org_levels:write', 'departments:write',
    'users:read', 'users:write',
    'roles:read',
    'audit:read',
  ],
  area_manager: [
    'companies:read', 'brands:read', 'branches:read', 'branches:write',
    'users:read',
  ],
  branch_manager: [
    'companies:read', 'brands:read', 'branches:read',
    'users:read',
  ],
  food_safety_officer: [
    'branches:read', 'users:read',
  ],
  internal_auditor: [
    'companies:read', 'brands:read', 'branches:read', 'users:read',
    'roles:read', 'audit:read',
  ],
  supervisor: ['branches:read', 'users:read'],
  inspector:  ['branches:read'],
  employee:   ['branches:read'],
};
