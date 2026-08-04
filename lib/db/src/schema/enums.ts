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

/* ---------------------------------------------------------------
 * Phase 3 — Task Engine
 * ------------------------------------------------------------- */

// The nature of the work item — separate from lifecycle status. Downstream
// phases (Inspections, HACCP, Incidents) will use these kinds when creating
// tasks, so the enum is defined ahead of their arrival.
export const taskKindEnum = pgEnum('task_kind', [
  'maintenance',
  'inspection_followup',
  'capa_action',
  'incident_response',
  'compliance',
  'sanitation',
  'training',
  'safety_check',
  'calibration',
  'ad_hoc',
  'other',
]);

// Lifecycle. "overdue" is computed at query time, not stored.
export const taskStatusEnum = pgEnum('task_status', [
  'draft',
  'open',
  'scheduled',
  'in_progress',
  'blocked',
  'in_review',
  'completed',
  'verified',
  'cancelled',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'normal',
  'high',
  'urgent',
  'critical',
]);

// Where a task came from. Machine-consumable — Phase 4/6/8 populate these
// values when creating tasks. `source_id` on tasks points back to the origin
// row (schedule id, inspection id, CCP deviation id, etc.).
export const taskSourceEnum = pgEnum('task_source', [
  'manual',
  'maintenance_schedule',
  'inspection',
  'ccp_deviation',
  'incident',
  'system',
  'ai',
]);

/* ---------------------------------------------------------------
 * Phase 4 — Inspection Engine
 * ------------------------------------------------------------- */

export const inspectionKindEnum = pgEnum('inspection_kind', [
  'internal_audit',
  'municipality_prep',   // dry-run before a municipality visit
  'municipality_visit',  // an actual municipality inspection (recorded)
  'sfda_audit',
  'haccp_audit',
  'food_safety_check',
  'daily_walkthrough',
  'safety_audit',
  'supplier_audit',
  'training_audit',
  'other',
]);

export const inspectionStatusEnum = pgEnum('inspection_status', [
  'scheduled',
  'in_progress',
  'submitted',   // finished by inspector, pending finalization
  'finalized',   // scored + immutable
  'cancelled',
]);

export const inspectionResponseValueEnum = pgEnum('inspection_response_value', [
  'pass',
  'fail',
  'partial',
  'not_applicable',
  'observed',    // an observed number/text answer (see numeric_value / text_value)
]);

export const findingSeverityEnum = pgEnum('finding_severity', [
  'observation',
  'minor',
  'major',
  'critical',
]);

export const findingStatusEnum = pgEnum('finding_status', [
  'open',
  'in_capa',
  'resolved',
  'accepted_risk',
  'closed',
  'reopened',
]);

export const inspectionEventTypeEnum = pgEnum('inspection_event_type', [
  'created',
  'scheduled',
  'started',
  'response_recorded',
  'response_updated',
  'evidence_added',
  'evidence_removed',
  'finding_created',
  'finding_updated',
  'section_completed',
  'submitted',
  'finalized',
  'cancelled',
  'reopened',
  'note_added',
  'ai_insight_added',
]);

// Immutable event log types for the task timeline. Extend by adding — never
// mutate an existing meaning; AI trainers depend on stable semantics.
export const taskEventTypeEnum = pgEnum('task_event_type', [
  'created',
  'updated',
  'assigned',
  'unassigned',
  'accepted',
  'status_changed',
  'priority_changed',
  'scheduled',
  'rescheduled',
  'started',
  'paused',
  'blocked',
  'unblocked',
  'checklist_item_completed',
  'checklist_item_uncompleted',
  'comment_added',
  'evidence_added',
  'evidence_removed',
  'submitted_for_review',
  'completed',
  'verified',
  'rejected',
  'cancelled',
  'dependency_added',
  'dependency_removed',
  'time_logged',
  'note_added',
  'ai_insight_added',
  'reassigned',
]);

