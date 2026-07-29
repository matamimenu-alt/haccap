// System roles (10) per SRS. `priority` matches the org hierarchy — lower = more privileged.
export const SYSTEM_ROLES = [
  { key: 'platform_super_admin', nameAr: 'مسؤول عام للمنصة', nameEn: 'Platform Super Admin', priority: 0 },
  { key: 'company_owner',        nameAr: 'مالك الشركة',       nameEn: 'Company Owner',        priority: 10 },
  { key: 'operations_director',  nameAr: 'مدير العمليات',      nameEn: 'Operations Director',  priority: 20 },
  { key: 'area_manager',         nameAr: 'مدير منطقة',         nameEn: 'Area Manager',         priority: 30 },
  { key: 'branch_manager',       nameAr: 'مدير فرع',           nameEn: 'Branch Manager',       priority: 40 },
  { key: 'food_safety_officer',  nameAr: 'مسؤول سلامة الغذاء', nameEn: 'Food Safety Officer',  priority: 45 },
  { key: 'internal_auditor',     nameAr: 'مدقق داخلي',         nameEn: 'Internal Auditor',     priority: 50 },
  { key: 'supervisor',           nameAr: 'مشرف',              nameEn: 'Supervisor',           priority: 60 },
  { key: 'inspector',            nameAr: 'مفتش',              nameEn: 'Inspector',            priority: 65 },
  { key: 'employee',             nameAr: 'موظف',              nameEn: 'Employee',             priority: 70 },
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]['key'];
