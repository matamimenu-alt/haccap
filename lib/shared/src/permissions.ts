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

  // Phase 2 — Operations Core
  areas_read:               { key: 'areas:read',               module: 'operations', action: 'read' },
  areas_write:              { key: 'areas:write',              module: 'operations', action: 'write' },
  asset_categories_read:    { key: 'asset_categories:read',    module: 'operations', action: 'read' },
  asset_categories_write:   { key: 'asset_categories:write',   module: 'operations', action: 'write' },
  suppliers_read:           { key: 'suppliers:read',           module: 'operations', action: 'read' },
  suppliers_write:          { key: 'suppliers:write',          module: 'operations', action: 'write' },
  assets_read:              { key: 'assets:read',              module: 'operations', action: 'read' },
  assets_write:             { key: 'assets:write',             module: 'operations', action: 'write' },
  assets_decommission:      { key: 'assets:decommission',      module: 'operations', action: 'decommission' },
  asset_events_read:        { key: 'asset_events:read',        module: 'operations', action: 'read' },
  asset_tags_read:          { key: 'asset_tags:read',          module: 'operations', action: 'read' },
  asset_tags_write:         { key: 'asset_tags:write',         module: 'operations', action: 'write' },
  warranties_read:          { key: 'warranties:read',          module: 'operations', action: 'read' },
  warranties_write:         { key: 'warranties:write',         module: 'operations', action: 'write' },
  maintenance_read:         { key: 'maintenance:read',         module: 'operations', action: 'read' },
  maintenance_write:        { key: 'maintenance:write',        module: 'operations', action: 'write' },
  attachments_read:         { key: 'attachments:read',         module: 'operations', action: 'read' },
  attachments_write:        { key: 'attachments:write',        module: 'operations', action: 'write' },
  qr_scan:                  { key: 'qr:scan',                  module: 'operations', action: 'scan' },
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['key'];

// Default role → permission mapping used at seed time.
export const ROLE_DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  platform_super_admin: Object.values(PERMISSIONS).map((p) => p.key),
  company_owner: Object.values(PERMISSIONS).map((p) => p.key),
  operations_director: [
    // Phase 1
    'companies:read', 'brands:read', 'brands:write',
    'branches:read', 'branches:write',
    'org_levels:write', 'departments:write',
    'users:read', 'users:write',
    'roles:read',
    'audit:read',
    // Phase 2
    'areas:read', 'areas:write',
    'asset_categories:read', 'asset_categories:write',
    'suppliers:read', 'suppliers:write',
    'assets:read', 'assets:write', 'assets:decommission',
    'asset_events:read',
    'asset_tags:read', 'asset_tags:write',
    'warranties:read', 'warranties:write',
    'maintenance:read', 'maintenance:write',
    'attachments:read', 'attachments:write',
    'qr:scan',
  ],
  area_manager: [
    'companies:read', 'brands:read', 'branches:read', 'branches:write',
    'users:read',
    'areas:read', 'areas:write',
    'asset_categories:read',
    'suppliers:read',
    'assets:read', 'assets:write',
    'asset_events:read',
    'asset_tags:read',
    'warranties:read', 'warranties:write',
    'maintenance:read', 'maintenance:write',
    'attachments:read', 'attachments:write',
    'qr:scan',
  ],
  branch_manager: [
    'companies:read', 'brands:read', 'branches:read',
    'users:read',
    'areas:read',
    'asset_categories:read',
    'suppliers:read',
    'assets:read', 'assets:write',
    'asset_events:read',
    'asset_tags:read',
    'warranties:read',
    'maintenance:read',
    'attachments:read', 'attachments:write',
    'qr:scan',
  ],
  food_safety_officer: [
    'branches:read', 'users:read',
    'areas:read',
    'asset_categories:read',
    'assets:read',
    'asset_events:read',
    'warranties:read',
    'maintenance:read',
    'attachments:read', 'attachments:write',
    'qr:scan',
  ],
  internal_auditor: [
    'companies:read', 'brands:read', 'branches:read', 'users:read',
    'roles:read', 'audit:read',
    'areas:read', 'asset_categories:read', 'suppliers:read',
    'assets:read', 'asset_events:read',
    'warranties:read', 'maintenance:read', 'attachments:read',
    'qr:scan',
  ],
  supervisor: [
    'branches:read', 'users:read',
    'areas:read', 'assets:read', 'asset_events:read',
    'maintenance:read', 'attachments:read', 'qr:scan',
  ],
  inspector: [
    'branches:read', 'areas:read', 'assets:read', 'asset_events:read',
    'attachments:read', 'qr:scan',
  ],
  employee: [
    'branches:read', 'areas:read', 'assets:read', 'qr:scan',
  ],
};
