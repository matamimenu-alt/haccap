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
