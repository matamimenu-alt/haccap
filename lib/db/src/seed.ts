/**
 * Seed the RCOS demo tenant.
 * Run with:  pnpm --filter @rcos/db seed
 *
 * Creates one demo company (Al-Nakheel Restaurant Group) with:
 *   - 2 brands, 4 branches across Riyadh / Jeddah / Dammam
 *   - Full 10 system roles + Phase 1 permission catalog
 *   - 3 demo users (owner, ops director, food safety officer) → password Admin@2026
 *   - A basic 5-level org hierarchy and 4 departments
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { eq, inArray } from 'drizzle-orm';
import { db, queryClient } from './index.js';
import {
  companies, brands, branches, departments, orgLevels,
  users, roles, permissions, rolePermissions, userRoles,
} from './schema/index.js';
import { SYSTEM_ROLES, PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '@rcos/shared';

const DEMO_PASSWORD = 'Admin@2026';

async function seed() {
  console.log('🌱 Seeding RCOS demo tenant…');

  // 1. Permission catalog (global)
  const permRows = Object.values(PERMISSIONS);
  for (const p of permRows) {
    await db
      .insert(permissions)
      .values({ key: p.key, module: p.module, action: p.action })
      .onConflictDoNothing({ target: permissions.key });
  }
  console.log(`  ✓ ${permRows.length} permissions upserted`);

  // 2. System roles (companyId = null)
  for (const r of SYSTEM_ROLES) {
    await db
      .insert(roles)
      .values({
        companyId: null,
        key: r.key,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        isSystem: true,
        priority: String(r.priority),
      })
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${SYSTEM_ROLES.length} system roles upserted`);

  // 3. Wire role → permissions
  const allPerms = await db.select().from(permissions);
  const permByKey = new Map(allPerms.map((p) => [p.key, p]));
  const systemRoleRows = await db
    .select()
    .from(roles)
    .where(inArray(roles.key, SYSTEM_ROLES.map((r) => r.key)));

  for (const role of systemRoleRows) {
    const keys = ROLE_DEFAULT_PERMISSIONS[role.key] ?? [];
    for (const key of keys) {
      const perm = permByKey.get(key);
      if (!perm) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: perm.id })
        .onConflictDoNothing();
    }
  }
  console.log('  ✓ role → permission mappings applied');

  // 4. Demo company
  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, 'al-nakheel'))
    .limit(1);

  const [company] = existingCompany
    ? [existingCompany]
    : await db
        .insert(companies)
        .values({
          slug: 'al-nakheel',
          nameAr: 'مجموعة مطاعم النخيل',
          nameEn: 'Al-Nakheel Restaurant Group',
          country: 'SA',
          defaultLocale: 'ar',
          timezone: 'Asia/Riyadh',
          status: 'active',
          commercialRegistration: '1010123456',
          vatNumber: '300123456700003',
          enabledModules: ['organization', 'compliance', 'haccp', 'food_safety', 'tasks', 'capa', 'reports'],
        })
        .returning();
  console.log(`  ✓ company: ${company.nameEn}`);

  // 5. Org hierarchy (5 levels)
  const orgLevelSpecs = [
    { depth: 0, nameAr: 'المالك',       nameEn: 'Ownership' },
    { depth: 1, nameAr: 'الإدارة العليا', nameEn: 'Executive' },
    { depth: 2, nameAr: 'المناطق',      nameEn: 'Area' },
    { depth: 3, nameAr: 'الفرع',        nameEn: 'Branch' },
    { depth: 4, nameAr: 'الفريق',       nameEn: 'Team' },
  ];
  for (const spec of orgLevelSpecs) {
    await db
      .insert(orgLevels)
      .values({ ...spec, companyId: company.id })
      .onConflictDoNothing();
  }

  // 6. Departments
  const depts = [
    { code: 'OPS', nameAr: 'العمليات',      nameEn: 'Operations' },
    { code: 'QA',  nameAr: 'الجودة والسلامة', nameEn: 'Quality & Safety' },
    { code: 'KIT', nameAr: 'المطبخ',         nameEn: 'Kitchen' },
    { code: 'FOH', nameAr: 'خدمة الصالة',    nameEn: 'Front of House' },
  ];
  for (const d of depts) {
    await db
      .insert(departments)
      .values({ ...d, companyId: company.id })
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${depts.length} departments seeded`);

  // 7. Brands
  const brandSpecs = [
    { slug: 'nakheel-grill',   nameAr: 'شواء النخيل',   nameEn: 'Nakheel Grill' },
    { slug: 'nakheel-express', nameAr: 'نخيل إكسبريس',  nameEn: 'Nakheel Express' },
  ];
  const brandRows: { id: string; slug: string }[] = [];
  for (const b of brandSpecs) {
    const [existing] = await db
      .select({ id: brands.id, slug: brands.slug })
      .from(brands)
      .where(eq(brands.slug, b.slug))
      .limit(1);
    if (existing) {
      brandRows.push(existing);
      continue;
    }
    const [row] = await db
      .insert(brands)
      .values({ ...b, companyId: company.id })
      .returning({ id: brands.id, slug: brands.slug });
    brandRows.push(row);
  }
  console.log(`  ✓ ${brandRows.length} brands seeded`);
  const grill = brandRows.find((b) => b.slug === 'nakheel-grill')!;
  const express = brandRows.find((b) => b.slug === 'nakheel-express')!;

  // 8. Branches
  const branchSpecs = [
    { code: 'RUH-01', brandId: grill.id,   nameAr: 'فرع الرياض - العليا',  nameEn: 'Riyadh - Olaya',      city: 'الرياض', restaurantType: 'fine_dining' as const, seatingCapacity: 120, staffHeadcount: 32 },
    { code: 'RUH-02', brandId: express.id, nameAr: 'فرع الرياض - النخيل',  nameEn: 'Riyadh - Al Nakheel', city: 'الرياض', restaurantType: 'fast_food' as const,   seatingCapacity: 60,  staffHeadcount: 18 },
    { code: 'JED-01', brandId: grill.id,   nameAr: 'فرع جدة - التحلية',    nameEn: 'Jeddah - Tahlia',     city: 'جدة',   restaurantType: 'casual_dining' as const, seatingCapacity: 90, staffHeadcount: 24 },
    { code: 'DMM-01', brandId: express.id, nameAr: 'فرع الدمام - الكورنيش', nameEn: 'Dammam - Corniche',   city: 'الدمام', restaurantType: 'shawarma' as const,     seatingCapacity: 40, staffHeadcount: 14 },
  ];
  for (const b of branchSpecs) {
    const [existing] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, b.code))
      .limit(1);
    if (existing) continue;
    await db.insert(branches).values({
      ...b,
      companyId: company.id,
      region: b.city,
      status: 'active',
      municipalityLicenseNumber: `MUN-${b.code}-2026`,
      municipalityLicenseExpiryDate: '2026-12-31',
    });
  }
  console.log(`  ✓ ${branchSpecs.length} branches seeded`);
  const allBranches = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.companyId, company.id));
  const allBranchIds = allBranches.map((b) => b.id);

  // 9. Roles + users
  const roleByKey = new Map(systemRoleRows.map((r) => [r.key, r]));

  const userSpecs = [
    {
      email: 'owner@rcos.demo',
      fullNameAr: 'محمد النخيلي',
      fullNameEn: 'Mohammed Al-Nakheli',
      roleKey: 'company_owner',
      branchIds: allBranchIds,
    },
    {
      email: 'ops@rcos.demo',
      fullNameAr: 'سارة العتيبي',
      fullNameEn: 'Sara Al-Otaibi',
      roleKey: 'operations_director',
      branchIds: allBranchIds,
    },
    {
      email: 'fso@rcos.demo',
      fullNameAr: 'خالد الحربي',
      fullNameEn: 'Khalid Al-Harbi',
      roleKey: 'food_safety_officer',
      branchIds: allBranchIds.slice(0, 2),
    },
  ];

  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  for (const spec of userSpecs) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, spec.email))
      .limit(1);
    if (existing) continue;

    const [created] = await db
      .insert(users)
      .values({
        companyId: company.id,
        email: spec.email,
        passwordHash,
        fullNameAr: spec.fullNameAr,
        fullNameEn: spec.fullNameEn,
        preferredLocale: 'ar',
        status: 'active',
        branchIds: spec.branchIds,
      })
      .returning({ id: users.id });

    const role = roleByKey.get(spec.roleKey);
    if (role) {
      await db.insert(userRoles).values({
        companyId: company.id,
        userId: created.id,
        roleId: role.id,
      });
    }
  }
  console.log(`  ✓ ${userSpecs.length} demo users seeded (password: ${DEMO_PASSWORD})`);

  console.log('\n✅ Seed complete.');
  console.log('   Log in at http://localhost:5173/login with:');
  console.log('   • owner@rcos.demo · ' + DEMO_PASSWORD);
  console.log('   • ops@rcos.demo · ' + DEMO_PASSWORD);
  console.log('   • fso@rcos.demo · ' + DEMO_PASSWORD);
}

seed()
  .then(() => queryClient.end({ timeout: 5 }))
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    await queryClient.end({ timeout: 5 });
    process.exit(1);
  });
