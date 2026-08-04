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
import { and, eq, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, queryClient } from './index.js';
import {
  companies, brands, branches, departments, orgLevels,
  users, roles, permissions, rolePermissions, userRoles,
  // Phase 2
  areas, assetCategories, suppliers, assets, assetQrCodes, assetTags,
  maintenanceSchedules,
  // Phase 3
  taskTemplates,
  // Phase 4
  inspectionTemplates,
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

  /* -------------------------------------------------------------
   * Phase 2 — Operations Core seed
   * ----------------------------------------------------------- */
  console.log('\n🌱 Seeding Operations Core…');

  // 10. System asset categories (companyId=NULL, isSystem=true)
  const systemCategories = [
    { key: 'refrigeration',                nameAr: 'التبريد',                     nameEn: 'Refrigeration',            parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'high', suggestedSpecs: [
        { key: 'target_temp_c', label: { ar: 'درجة الحرارة المستهدفة (م)', en: 'Target temperature (°C)' }, type: 'number', unit: '°C' },
        { key: 'refrigerant',   label: { ar: 'نوع المبرد',              en: 'Refrigerant type' },       type: 'string' },
    ], aiHints: { failureModes: ['compressor', 'seal', 'refrigerant_leak'], monitors: ['temp'], compliance: ['haccp', 'sfda'] } },
    { key: 'refrigeration.walk_in_cooler', nameAr: 'غرفة تبريد',                  nameEn: 'Walk-in Cooler',           parent: 'refrigeration',                  defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'refrigeration.walk_in_freezer',nameAr: 'غرفة تجميد',                  nameEn: 'Walk-in Freezer',          parent: 'refrigeration',                  defaultAssetKind: 'equipment', riskLevel: 'critical' },
    { key: 'refrigeration.reach_in',       nameAr: 'ثلاجة عادية',                 nameEn: 'Reach-in Cooler',          parent: 'refrigeration',                  defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'refrigeration.display',        nameAr: 'عرض مبرد',                    nameEn: 'Display Cooler',           parent: 'refrigeration',                  defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'cooking',                      nameAr: 'الطهي',                       nameEn: 'Cooking',                  parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'high', aiHints: { failureModes: ['burner', 'ignition', 'thermostat'], compliance: ['haccp', 'fire_safety'] } },
    { key: 'cooking.oven',                 nameAr: 'فرن',                         nameEn: 'Oven',                     parent: 'cooking',                        defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'cooking.grill',                nameAr: 'مشواة',                       nameEn: 'Grill',                    parent: 'cooking',                        defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'cooking.fryer',                nameAr: 'قلاية',                       nameEn: 'Deep Fryer',               parent: 'cooking',                        defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'cooking.shawarma_machine',     nameAr: 'ماكينة شاورما',               nameEn: 'Shawarma Machine',         parent: 'cooking',                        defaultAssetKind: 'equipment', riskLevel: 'critical', aiHints: { ccpTemperature: 75 } },
    { key: 'warewashing',                  nameAr: 'غسيل الأواني',                nameEn: 'Warewashing',              parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'warewashing.dishwasher',       nameAr: 'غسالة صحون',                  nameEn: 'Dishwasher',               parent: 'warewashing',                    defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'warewashing.three_compartment',nameAr: 'حوض ثلاثي',                   nameEn: '3-Compartment Sink',       parent: 'warewashing',                    defaultAssetKind: 'fixture',   riskLevel: 'medium' },
    { key: 'prep',                         nameAr: 'التحضير',                     nameEn: 'Prep',                     parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'low' },
    { key: 'prep.slicer',                  nameAr: 'مقطعة',                       nameEn: 'Slicer',                   parent: 'prep',                           defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'prep.mixer',                   nameAr: 'خلاط',                        nameEn: 'Mixer',                    parent: 'prep',                           defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'sensors',                      nameAr: 'المستشعرات',                  nameEn: 'Sensors',                  parent: null,                             defaultAssetKind: 'sensor',    riskLevel: 'medium', aiHints: { emitsTelemetry: true } },
    { key: 'sensors.temperature',          nameAr: 'مستشعر حرارة',                nameEn: 'Temperature Sensor',       parent: 'sensors',                        defaultAssetKind: 'sensor',    riskLevel: 'medium' },
    { key: 'sensors.humidity',             nameAr: 'مستشعر رطوبة',                nameEn: 'Humidity Sensor',          parent: 'sensors',                        defaultAssetKind: 'sensor',    riskLevel: 'low' },
    { key: 'safety',                       nameAr: 'السلامة',                     nameEn: 'Safety',                   parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'critical', aiHints: { compliance: ['civil_defense'] } },
    { key: 'safety.fire_extinguisher',     nameAr: 'طفاية حريق',                  nameEn: 'Fire Extinguisher',        parent: 'safety',                         defaultAssetKind: 'equipment', riskLevel: 'critical' },
    { key: 'safety.hood_suppression',      nameAr: 'نظام إطفاء الشفاط',           nameEn: 'Hood Fire Suppression',    parent: 'safety',                         defaultAssetKind: 'equipment', riskLevel: 'critical' },
    { key: 'hvac',                         nameAr: 'التكييف والتهوية',            nameEn: 'HVAC',                     parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'medium' },
    { key: 'hvac.exhaust_hood',            nameAr: 'شفاط',                        nameEn: 'Exhaust Hood',             parent: 'hvac',                           defaultAssetKind: 'equipment', riskLevel: 'high' },
    { key: 'storage',                      nameAr: 'التخزين',                     nameEn: 'Storage',                  parent: null,                             defaultAssetKind: 'fixture',   riskLevel: 'low' },
    { key: 'storage.shelving',             nameAr: 'أرفف',                        nameEn: 'Shelving',                 parent: 'storage',                        defaultAssetKind: 'fixture',   riskLevel: 'low' },
    { key: 'pest_control',                 nameAr: 'مكافحة الآفات',               nameEn: 'Pest Control',             parent: null,                             defaultAssetKind: 'equipment', riskLevel: 'high', aiHints: { compliance: ['municipality'] } },
  ] as const;

  const catByKey = new Map<string, string>();
  for (const spec of systemCategories) {
    const parentPath = spec.parent ? catByKey.get(spec.parent) : null;
    const path = parentPath ? `${parentPath}/${spec.key.split('.').pop()}` : spec.key;
    const depth = spec.parent ? path.split('/').length - 1 : 0;

    const [existing] = await db
      .select({ id: assetCategories.id, path: assetCategories.path })
      .from(assetCategories)
      .where(eq(assetCategories.key, spec.key))
      .limit(1);

    if (existing) {
      catByKey.set(spec.key, existing.path);
      continue;
    }
    const [row] = await db
      .insert(assetCategories)
      .values({
        companyId: null,
        parentId: spec.parent ? await (async () => {
          const [p] = await db.select({ id: assetCategories.id }).from(assetCategories).where(eq(assetCategories.key, spec.parent!)).limit(1);
          return p?.id ?? null;
        })() : null,
        key: spec.key,
        nameAr: spec.nameAr,
        nameEn: spec.nameEn,
        path,
        depth,
        defaultAssetKind: spec.defaultAssetKind as 'equipment' | 'sensor' | 'fixture',
        riskLevel: spec.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        suggestedSpecs: 'suggestedSpecs' in spec ? spec.suggestedSpecs : [],
        aiHints: 'aiHints' in spec ? spec.aiHints ?? {} : {},
        isSystem: true,
      })
      .returning({ id: assetCategories.id, path: assetCategories.path });
    catByKey.set(spec.key, row.path);
  }
  console.log(`  ✓ ${systemCategories.length} system asset categories seeded`);

  // 11. Areas per branch (kitchen + walk-in cooler + prep + dining)
  const branchRows = await db.select().from(branches).where(eq(branches.companyId, company.id));
  const areaSpecs = (branchId: string) => [
    { code: 'KIT',  nameAr: 'المطبخ',        nameEn: 'Kitchen',          kind: 'kitchen'      as const, riskLevel: 'high'   as const, complianceScope: ['haccp', 'sfda'] },
    { code: 'WIC',  nameAr: 'غرفة التبريد',  nameEn: 'Walk-in Cooler',   kind: 'cold_storage' as const, riskLevel: 'high'   as const, complianceScope: ['haccp', 'sfda'], targetTempMinC: '0',  targetTempMaxC: '4' },
    { code: 'WIF',  nameAr: 'غرفة التجميد',  nameEn: 'Walk-in Freezer',  kind: 'freezer'      as const, riskLevel: 'critical' as const, complianceScope: ['haccp', 'sfda'], targetTempMinC: '-25', targetTempMaxC: '-15' },
    { code: 'PREP', nameAr: 'التحضير',       nameEn: 'Prep Line',        kind: 'prep'         as const, riskLevel: 'medium' as const, complianceScope: ['haccp'] },
    { code: 'DISH', nameAr: 'غسيل الصحون',   nameEn: 'Dishwash',         kind: 'dishwash'     as const, riskLevel: 'low'    as const },
    { code: 'DINE', nameAr: 'صالة الطعام',   nameEn: 'Dining',           kind: 'dining'       as const, riskLevel: 'low'    as const },
  ];
  const areaIds = new Map<string, string>(); // key: `${branchId}:${code}`
  for (const branch of branchRows) {
    for (const a of areaSpecs(branch.id)) {
      const [existing] = await db
        .select({ id: areas.id })
        .from(areas)
        .where(and(eq(areas.branchId, branch.id), eq(areas.code, a.code)))
        .limit(1);
      if (existing) {
        areaIds.set(`${branch.id}:${a.code}`, existing.id);
        continue;
      }
      const [row] = await db
        .insert(areas)
        .values({
          companyId: company.id,
          branchId: branch.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn,
          kind: a.kind,
          riskLevel: a.riskLevel,
          complianceScope: a.complianceScope ?? [],
          targetTempMinC: 'targetTempMinC' in a ? a.targetTempMinC : null,
          targetTempMaxC: 'targetTempMaxC' in a ? a.targetTempMaxC : null,
          aiSummary: `${a.nameEn} — ${branch.city}`,
          aiMetadata: { kind: a.kind, complianceScope: a.complianceScope ?? [] },
        })
        .returning({ id: areas.id });
      areaIds.set(`${branch.id}:${a.code}`, row.id);
    }
  }
  console.log(`  ✓ areas seeded for ${branchRows.length} branches`);

  // 12. Suppliers (a few realistic vendors)
  const supplierSpecs = [
    { code: 'SUP-COLD', nameAr: 'شركة التبريد المتقدمة',  nameEn: 'Advanced Cooling Co.',     categories: ['equipment', 'refrigeration'], city: 'الرياض', isPreferred: true },
    { code: 'SUP-KIT',  nameAr: 'معدات المطاعم الحديثة',  nameEn: 'Modern Restaurant Equip.', categories: ['equipment', 'cooking'],       city: 'جدة',   isPreferred: true },
    { code: 'SUP-SAFE', nameAr: 'السلامة الأولى',         nameEn: 'Safety First',              categories: ['fire_safety', 'safety'],       city: 'الرياض' },
    { code: 'SUP-PEST', nameAr: 'مكافحة الآفات الاحترافية', nameEn: 'ProPest Control',           categories: ['pest_control', 'sanitation'], city: 'الدمام' },
  ];
  const supplierIds = new Map<string, string>();
  for (const s of supplierSpecs) {
    const [existing] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.companyId, company.id), eq(suppliers.code, s.code)))
      .limit(1);
    if (existing) {
      supplierIds.set(s.code, existing.id);
      continue;
    }
    const [row] = await db
      .insert(suppliers)
      .values({
        companyId: company.id,
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        categories: s.categories,
        city: s.city,
        isPreferred: s.isPreferred ?? false,
        aiSummary: `${s.nameEn} · ${s.categories.join(', ')}`,
      })
      .returning({ id: suppliers.id });
    supplierIds.set(s.code, row.id);
  }
  console.log(`  ✓ ${supplierSpecs.length} suppliers seeded`);

  // 13. A handful of tags
  const tagSpecs = [
    { key: 'high-value',   labelAr: 'عالي القيمة',   labelEn: 'High-Value',    colorHex: '#f59e0b' },
    { key: 'leased',       labelAr: 'مستأجر',        labelEn: 'Leased',        colorHex: '#8b5cf6' },
    { key: 'grant-funded', labelAr: 'ممول بمنحة',    labelEn: 'Grant-Funded',  colorHex: '#10b981' },
  ];
  for (const tag of tagSpecs) {
    await db
      .insert(assetTags)
      .values({ ...tag, companyId: company.id })
      .onConflictDoNothing();
  }

  // 14. Sample assets in the Riyadh Olaya branch (RUH-01)
  const olaya = branchRows.find((b) => b.code === 'RUH-01');
  if (olaya) {
    const [wicCat] = await db.select().from(assetCategories).where(eq(assetCategories.key, 'refrigeration.walk_in_cooler')).limit(1);
    const [shawarmaCat] = await db.select().from(assetCategories).where(eq(assetCategories.key, 'cooking.shawarma_machine')).limit(1);
    const [extCat] = await db.select().from(assetCategories).where(eq(assetCategories.key, 'safety.fire_extinguisher')).limit(1);

    const kitchenAreaId = areaIds.get(`${olaya.id}:KIT`)!;
    const wicAreaId = areaIds.get(`${olaya.id}:WIC`)!;

    const assetSpecs = [
      {
        code: 'WIC-01', nameAr: 'غرفة تبريد المطبخ الرئيسي', nameEn: 'Main Kitchen Walk-in Cooler',
        areaId: wicAreaId, categoryId: wicCat?.id ?? null,
        manufacturer: 'Foster', model: 'FSL2200H', serialNumber: 'FS-2200-11245',
        spec: { target_temp_c: 3, refrigerant: 'R290' },
        criticality: 'critical' as const, riskLevel: 'high' as const,
        supplierCode: 'SUP-COLD',
      },
      {
        code: 'SHW-01', nameAr: 'ماكينة شاورما دجاج', nameEn: 'Chicken Shawarma Machine #1',
        areaId: kitchenAreaId, categoryId: shawarmaCat?.id ?? null,
        manufacturer: 'Archway', model: 'V8-SW', serialNumber: 'AR-V8-77201',
        spec: { burners: 8, gas: 'LPG' },
        criticality: 'high' as const, riskLevel: 'high' as const,
        supplierCode: 'SUP-KIT',
      },
      {
        code: 'EXT-01', nameAr: 'طفاية حريق CO2 - المطبخ', nameEn: 'CO2 Fire Extinguisher - Kitchen',
        areaId: kitchenAreaId, categoryId: extCat?.id ?? null,
        manufacturer: 'Naffco', model: 'CO2-5KG', serialNumber: 'NF-CO2-88932',
        spec: { capacity_kg: 5, class: 'BC' },
        criticality: 'critical' as const, riskLevel: 'critical' as const,
        supplierCode: 'SUP-SAFE',
      },
    ];

    for (const spec of assetSpecs) {
      const [existing] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.companyId, company.id), eq(assets.code, spec.code)))
        .limit(1);
      if (existing) continue;

      const [asset] = await db
        .insert(assets)
        .values({
          companyId: company.id,
          branchId: olaya.id,
          areaId: spec.areaId,
          categoryId: spec.categoryId,
          kind: 'equipment',
          code: spec.code,
          nameAr: spec.nameAr,
          nameEn: spec.nameEn,
          manufacturer: spec.manufacturer,
          model: spec.model,
          serialNumber: spec.serialNumber,
          spec: spec.spec,
          status: 'operational',
          criticality: spec.criticality,
          riskLevel: spec.riskLevel,
          supplierId: supplierIds.get(spec.supplierCode) ?? null,
          currency: 'SAR',
          aiSummary: `${spec.nameEn} · ${spec.manufacturer} ${spec.model} · Riyadh Olaya`,
          aiMetadata: { criticality: spec.criticality, specKeys: Object.keys(spec.spec) },
          searchText: [spec.nameEn, spec.manufacturer, spec.model, spec.serialNumber, JSON.stringify(spec.spec)].join(' ').toLowerCase(),
        })
        .returning({ id: assets.id });

      await db.insert(assetQrCodes).values({
        companyId: company.id,
        assetId: asset.id,
        token: randomBytes(18).toString('base64url'),
        isActive: true,
      });
    }
    console.log(`  ✓ ${assetSpecs.length} demo assets seeded at Riyadh Olaya`);
  }

  /* -------------------------------------------------------------
   * Phase 3 — Task Engine seed
   * ----------------------------------------------------------- */
  console.log('\n🌱 Seeding Task Engine…');

  // Task templates
  const taskTemplateSpecs = [
    {
      key: 'walkin_cooler_monthly',
      titleAr: 'صيانة شهرية لغرفة التبريد',
      titleEn: 'Monthly walk-in cooler maintenance',
      description: 'Verify temp, inspect gaskets, clean condenser, check refrigerant.',
      kind: 'maintenance' as const,
      defaultPriority: 'high' as const,
      defaultRisk: 'high' as const,
      estimatedDurationMinutes: 45,
      requiresEvidence: true,
      requiresVerification: true,
      checklistItems: [
        { key: 'temp_check',       labelAr: 'قياس الحرارة (0-4°م)', labelEn: 'Verify temperature (0-4°C)',   required: true,  type: 'number' },
        { key: 'gaskets',          labelAr: 'فحص العوازل',           labelEn: 'Inspect door gaskets',         required: true,  type: 'checkbox' },
        { key: 'condenser_clean',  labelAr: 'تنظيف المكثف',          labelEn: 'Clean condenser coils',        required: true,  type: 'checkbox' },
        { key: 'refrigerant',      labelAr: 'فحص المبرد',            labelEn: 'Check refrigerant level',      required: false, type: 'checkbox' },
        { key: 'defrost_drain',    labelAr: 'فحص صرف مياه الإذابة',  labelEn: 'Inspect defrost drain',        required: false, type: 'checkbox' },
      ],
      requiredAttachments: [
        { kind: 'photo', minCount: 1, labelAr: 'صورة قراءة الحرارة', labelEn: 'Temperature reading photo' },
      ],
      aiHints: { relatedCategoryKeys: ['refrigeration.walk_in_cooler'], failureRiskFactors: ['high_ambient', 'seal_wear'] },
    },
    {
      key: 'fire_extinguisher_monthly',
      titleAr: 'الفحص الشهري لطفاية الحريق',
      titleEn: 'Monthly fire extinguisher inspection',
      description: 'Verify pressure, seal, and physical condition.',
      kind: 'safety_check' as const,
      defaultPriority: 'high' as const,
      defaultRisk: 'critical' as const,
      estimatedDurationMinutes: 10,
      requiresEvidence: true,
      requiresVerification: true,
      checklistItems: [
        { key: 'pressure_ok',  labelAr: 'مؤشر الضغط في المنطقة الخضراء', labelEn: 'Pressure gauge in green', required: true, type: 'checkbox' },
        { key: 'seal_intact',  labelAr: 'الختم سليم',                   labelEn: 'Safety seal intact',       required: true, type: 'checkbox' },
        { key: 'no_damage',    labelAr: 'خالٍ من الأضرار الظاهرة',       labelEn: 'No visible damage',        required: true, type: 'checkbox' },
        { key: 'tag_updated',  labelAr: 'بطاقة الفحص محدثة',            labelEn: 'Inspection tag updated',   required: true, type: 'checkbox' },
      ],
      requiredAttachments: [
        { kind: 'photo', minCount: 1, labelAr: 'صورة الطفاية', labelEn: 'Extinguisher photo' },
      ],
      aiHints: { compliance: ['civil_defense'], relatedCategoryKeys: ['safety.fire_extinguisher'] },
    },
    {
      key: 'shawarma_ccp_daily',
      titleAr: 'مراقبة نقطة التحكم الحرجة - شاورما',
      titleEn: 'Daily shawarma CCP monitoring',
      description: 'Verify cone core temperature ≥75°C at peak service.',
      kind: 'compliance' as const,
      defaultPriority: 'critical' as const,
      defaultRisk: 'critical' as const,
      estimatedDurationMinutes: 5,
      requiresEvidence: true,
      requiresVerification: false,
      checklistItems: [
        { key: 'core_temp',      labelAr: 'حرارة قلب المخروط (≥75°م)', labelEn: 'Cone core temperature (≥75°C)', required: true, type: 'number' },
        { key: 'holding_temp',   labelAr: 'حرارة الحفظ (≥60°م)',        labelEn: 'Holding temperature (≥60°C)',   required: true, type: 'number' },
      ],
      requiredAttachments: [
        { kind: 'photo', minCount: 1, labelAr: 'صورة الميزان الحراري', labelEn: 'Thermometer reading photo' },
      ],
      aiHints: { compliance: ['haccp', 'sfda'], relatedCategoryKeys: ['cooking.shawarma_machine'], ccpTemperature: 75 },
    },
  ];

  for (const spec of taskTemplateSpecs) {
    await db
      .insert(taskTemplates)
      .values({ ...spec, companyId: company.id })
      .onConflictDoNothing({ target: [taskTemplates.companyId, taskTemplates.key] });
  }
  console.log(`  ✓ ${taskTemplateSpecs.length} task templates seeded`);

  // Wire one due maintenance schedule to the walk-in cooler asset so the
  // materialization tick produces a visible task on first run.
  const [wicAsset] = await db.select().from(assets).where(and(eq(assets.companyId, company.id), eq(assets.code, 'WIC-01'))).limit(1);
  const [wicTpl] = await db.select({ id: taskTemplates.id }).from(taskTemplates).where(and(eq(taskTemplates.companyId, company.id), eq(taskTemplates.key, 'walkin_cooler_monthly'))).limit(1);
  if (wicAsset) {
    const [existing] = await db
      .select({ id: maintenanceSchedules.id })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.companyId, company.id), eq(maintenanceSchedules.assetId, wicAsset.id)))
      .limit(1);
    if (!existing) {
      const now = new Date();
      const nextDue = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now — visible on first tick
      await db.insert(maintenanceSchedules).values({
        companyId: company.id,
        assetId: wicAsset.id,
        titleAr: 'صيانة شهرية لغرفة التبريد',
        titleEn: 'Monthly walk-in cooler maintenance',
        kind: 'preventive',
        frequency: 'monthly',
        intervalCount: 1,
        riskIfSkipped: 'high',
        startsOn: now,
        nextDueAt: nextDue,
        estimatedDurationMinutes: 45,
        requiresShutdown: false,
        playbook: { templateKey: wicTpl?.id ? 'walkin_cooler_monthly' : undefined },
      });
      console.log('  ✓ 1 maintenance schedule wired (walk-in cooler, due in 30 min)');
    }
  }

  /* -------------------------------------------------------------
   * Phase 4 — Inspection Engine seed
   * ----------------------------------------------------------- */
  console.log('\n🌱 Seeding Inspection Engine…');

  const municipalityKitchenSections = [
    { key: 'personal',  labelAr: 'النظافة الشخصية للعاملين', labelEn: 'Personal hygiene',     weight: 2, order: 1 },
    { key: 'facility',  labelAr: 'حالة المنشأة',              labelEn: 'Facility condition',   weight: 1, order: 2 },
    { key: 'storage',   labelAr: 'تخزين الأغذية',             labelEn: 'Food storage',         weight: 3, order: 3 },
    { key: 'temp',      labelAr: 'مراقبة الحرارة',            labelEn: 'Temperature control',  weight: 3, order: 4 },
    { key: 'cleaning',  labelAr: 'التنظيف والتعقيم',          labelEn: 'Cleaning & sanitation',weight: 2, order: 5 },
    { key: 'pest',      labelAr: 'مكافحة الآفات',             labelEn: 'Pest control',         weight: 2, order: 6 },
    { key: 'safety',    labelAr: 'السلامة',                    labelEn: 'Safety',              weight: 2, order: 7 },
  ];
  const municipalityKitchenItems = [
    { key: 'p1', sectionKey: 'personal',  labelAr: 'ارتداء الزي والقفازات', labelEn: 'Proper uniform + gloves', type: 'yesno' as const, weight: 1, critical: false },
    { key: 'p2', sectionKey: 'personal',  labelAr: 'شهادات صحية سارية',      labelEn: 'Valid health certificates', type: 'yesno' as const, weight: 2, critical: true },
    { key: 'p3', sectionKey: 'personal',  labelAr: 'غسيل الأيدي المتكرر',    labelEn: 'Frequent handwashing',      type: 'yesno' as const, weight: 1, critical: false },
    { key: 'f1', sectionKey: 'facility',  labelAr: 'حالة الجدران والأرضيات',  labelEn: 'Walls + floors condition',  type: 'scale5' as const, weight: 1, critical: false },
    { key: 'f2', sectionKey: 'facility',  labelAr: 'التهوية والإضاءة',       labelEn: 'Ventilation + lighting',    type: 'scale5' as const, weight: 1, critical: false },
    { key: 's1', sectionKey: 'storage',   labelAr: 'فصل الخام عن المطهو',   labelEn: 'Raw / cooked separation',   type: 'yesno' as const, weight: 3, critical: true },
    { key: 's2', sectionKey: 'storage',   labelAr: 'تواريخ الصلاحية',        labelEn: 'Expiry dates on all items', type: 'yesno' as const, weight: 2, critical: true },
    { key: 't1', sectionKey: 'temp',      labelAr: 'حرارة غرفة التبريد (≤4°م)', labelEn: 'Walk-in cooler ≤ 4°C',   type: 'numeric' as const, weight: 3, critical: true, passIf: { op: 'lte' as const, value: 4 }, unit: '°C' },
    { key: 't2', sectionKey: 'temp',      labelAr: 'حرارة التجميد (≤-18°م)',   labelEn: 'Freezer ≤ -18°C',        type: 'numeric' as const, weight: 3, critical: true, passIf: { op: 'lte' as const, value: -18 }, unit: '°C' },
    { key: 't3', sectionKey: 'temp',      labelAr: 'حرارة حفظ الطهو (≥60°م)', labelEn: 'Hot hold ≥ 60°C',        type: 'numeric' as const, weight: 2, critical: false, passIf: { op: 'gte' as const, value: 60 }, unit: '°C' },
    { key: 'c1', sectionKey: 'cleaning',  labelAr: 'برنامج تنظيف موثق',       labelEn: 'Documented cleaning program', type: 'yesno' as const, weight: 1, critical: false },
    { key: 'c2', sectionKey: 'cleaning',  labelAr: 'مواد التعقيم متاحة',      labelEn: 'Sanitizer available + labeled', type: 'yesno' as const, weight: 2, critical: false },
    { key: 'pc1', sectionKey: 'pest',      labelAr: 'عقد مكافحة آفات نشط',    labelEn: 'Active pest-control contract', type: 'yesno' as const, weight: 2, critical: false },
    { key: 'pc2', sectionKey: 'pest',      labelAr: 'لا آثار للآفات',         labelEn: 'No signs of pests',          type: 'yesno' as const, weight: 3, critical: true },
    { key: 'sa1', sectionKey: 'safety',    labelAr: 'طفايات الحريق سارية',    labelEn: 'Fire extinguishers valid',   type: 'yesno' as const, weight: 2, critical: true },
    { key: 'sa2', sectionKey: 'safety',    labelAr: 'مخارج الطوارئ سالكة',    labelEn: 'Emergency exits clear',     type: 'yesno' as const, weight: 2, critical: true },
  ];

  const inspectionTemplateSpecs = [
    {
      key: 'municipality_kitchen_v1',
      version: 1,
      kind: 'municipality_prep' as const,
      titleAr: 'قائمة تفتيش البلدية — المطبخ',
      titleEn: 'Municipality Kitchen Inspection',
      description: 'Standard municipality kitchen inspection checklist adapted for Saudi restaurants.',
      issuingAuthority: 'Riyadh Municipality',
      regulatoryRef: 'Food Safety Guideline 2024',
      passThreshold: 85,
      sections: municipalityKitchenSections,
      items: municipalityKitchenItems,
      scopeTargets: ['branch'],
      aiHints: { compliance: ['municipality', 'sfda'], relatedCategoryKeys: ['refrigeration', 'cooking', 'safety', 'pest_control'] },
      isSystem: false,
    },
    {
      key: 'daily_walkthrough_v1',
      version: 1,
      kind: 'daily_walkthrough' as const,
      titleAr: 'الجولة اليومية للمشرف',
      titleEn: 'Daily supervisor walkthrough',
      description: 'Quick daily walkthrough capturing hygiene, temperatures, and safety highlights.',
      passThreshold: 80,
      sections: [
        { key: 'open',  labelAr: 'الفتح',    labelEn: 'Opening',        order: 1 },
        { key: 'peak',  labelAr: 'الذروة',   labelEn: 'Peak service',   order: 2 },
        { key: 'close', labelAr: 'الإغلاق', labelEn: 'Closing',        order: 3 },
      ],
      items: [
        { key: 'o1', sectionKey: 'open',  labelAr: 'حرارة غرفة التبريد صباحًا', labelEn: 'Cooler AM temperature', type: 'numeric' as const, weight: 1, passIf: { op: 'lte' as const, value: 4 }, unit: '°C' },
        { key: 'p1', sectionKey: 'peak',  labelAr: 'حرارة الشاورما (≥75°م)',    labelEn: 'Shawarma core (≥75°C)', type: 'numeric' as const, weight: 3, critical: true, passIf: { op: 'gte' as const, value: 75 }, unit: '°C' },
        { key: 'c1', sectionKey: 'close', labelAr: 'مطبخ نظيف عند الإغلاق',    labelEn: 'Kitchen clean at close', type: 'yesno' as const, weight: 1 },
      ],
      scopeTargets: ['branch'],
      aiHints: { compliance: ['haccp'], relatedCategoryKeys: ['refrigeration', 'cooking.shawarma_machine'] },
    },
  ];

  for (const spec of inspectionTemplateSpecs) {
    await db
      .insert(inspectionTemplates)
      .values({ ...spec, companyId: company.id })
      .onConflictDoNothing({ target: [inspectionTemplates.companyId, inspectionTemplates.key, inspectionTemplates.version] });
  }
  console.log(`  ✓ ${inspectionTemplateSpecs.length} inspection templates seeded`);

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
