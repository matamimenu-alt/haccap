import { pgEnum } from 'drizzle-orm/pg-core';

export const restaurantTypeEnum = pgEnum('restaurant_type', [
  'fast_food',
  'casual_dining',
  'fine_dining',
  'shawarma',
  'bakery',
  'coffee_shop',
  'buffet',
  'cloud_kitchen',
  'catering',
  'other',
]);

export const companyStatusEnum = pgEnum('company_status', [
  'trial',
  'active',
  'suspended',
  'archived',
]);

export const branchStatusEnum = pgEnum('branch_status', [
  'active',
  'inactive',
  'closed_for_renovation',
  'permanently_closed',
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'suspended',
  'deactivated',
]);

export const localeEnum = pgEnum('locale', ['ar', 'en']);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'export',
  'assign',
  'approve',
  'reject',
]);

/* ---------------------------------------------------------------
 * Phase 2 — Operations Core
 * ------------------------------------------------------------- */

// Area kind is the *function* of a space inside a branch. Downstream modules
// (inspections, HACCP, food-safety) key off this to auto-scope checks.
export const areaKindEnum = pgEnum('area_kind', [
  'kitchen',
  'cook_line',
  'prep',
  'dishwash',
  'cold_storage',
  'freezer',
  'dry_storage',
  'receiving',
  'waste',
  'mechanical',
  'dining',
  'restroom',
  'office',
  'front_of_house',
  'outdoor',
  'other',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'operational',
  'needs_repair',
  'under_maintenance',
  'out_of_service',
  'in_storage',
  'decommissioned',
]);

// Downtime impact / compliance criticality. Drives task priority + AI ranking.
export const assetCriticalityEnum = pgEnum('asset_criticality', [
  'low',
  'medium',
  'high',
  'critical',
]);

// The type of "thing" — assets can be equipment, fixtures, signage, tools, etc.
// Equipment is NOT a separate table; a fridge is an asset with kind=equipment
// and a category_id pointing into the Refrigeration branch of the taxonomy.
export const assetKindEnum = pgEnum('asset_kind', [
  'equipment',
  'fixture',
  'furniture',
  'vehicle',
  'signage',
  'tool',
  'sensor',
  'container',
  'facility',
  'other',
]);

export const warrantyTypeEnum = pgEnum('warranty_type', [
  'manufacturer',
  'extended',
  'service_contract',
  'insurance',
  'other',
]);

export const attachmentKindEnum = pgEnum('attachment_kind', [
  'document',
  'photo',
  'video',
  'audio',
  'other',
]);

// Polymorphic target types for attachments and events. Enum kept tight so the
// system-wide surface is enumerable — AI tool-use loops can reason about it.
export const polymorphicTargetTypeEnum = pgEnum('polymorphic_target_type', [
  'asset',
  'area',
  'branch',
  'brand',
  'company',
  'supplier',
  'warranty',
  'maintenance_schedule',
  'inspection',
  'task',
  'incident',
]);

// Immutable event log types. Add new types by extending this enum — never
// mutate an existing meaning. AI trainers key off these.
export const assetEventTypeEnum = pgEnum('asset_event_type', [
  'created',
  'updated',
  'moved',
  'status_changed',
  'category_changed',
  'kind_changed',
  'tagged',
  'untagged',
  'warranty_added',
  'warranty_updated',
  'warranty_expired',
  'maintenance_scheduled',
  'maintenance_updated',
  'maintenance_completed',
  'service_performed',
  'inspected',
  'decommissioned',
  'reinstated',
  'document_added',
  'document_removed',
  'photo_added',
  'photo_removed',
  'qr_generated',
  'qr_reprinted',
  'spec_updated',
  'supplier_assigned',
  'note_added',
]);

export const maintenanceFrequencyEnum = pgEnum('maintenance_frequency', [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semi_annually',
  'annually',
  'usage_based',
  'condition_based',
  'custom',
]);

export const maintenanceKindEnum = pgEnum('maintenance_kind', [
  'preventive',
  'corrective',
  'predictive',
  'inspection',
  'calibration',
  'sanitation',
  'safety_check',
  'other',
]);

export const riskLevelEnum = pgEnum('risk_level', ['none', 'low', 'medium', 'high', 'critical']);

