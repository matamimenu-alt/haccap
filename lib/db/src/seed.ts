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
  // Phase 5
  knowledgeArticles, knowledgeArticleLinks, knowledgeArticleVersions, knowledgeCategories,
  // Phase 6
  haccpPlans, hazards, ccps,
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

  /* -------------------------------------------------------------
   * Phase 5 — Knowledge Engine seed
   * ----------------------------------------------------------- */
  console.log('\n🌱 Seeding Knowledge Engine…');

  const knowledgeCategorySpecs = [
    { key: 'food_safety',      nameAr: 'سلامة الغذاء',     nameEn: 'Food Safety',      parent: null },
    { key: 'food_safety.haccp',nameAr: 'الهاسب',           nameEn: 'HACCP',            parent: 'food_safety' },
    { key: 'food_safety.ssop', nameAr: 'إجراءات النظافة',   nameEn: 'SSOP',             parent: 'food_safety' },
    { key: 'food_safety.gmp',  nameAr: 'ممارسات التصنيع',  nameEn: 'GMP',              parent: 'food_safety' },
    { key: 'food_safety.ghp',  nameAr: 'ممارسات النظافة',  nameEn: 'GHP',              parent: 'food_safety' },
    { key: 'operations',       nameAr: 'العمليات',         nameEn: 'Operations',       parent: null },
    { key: 'operations.cleaning', nameAr: 'التنظيف والتعقيم', nameEn: 'Cleaning & Sanitation', parent: 'operations' },
    { key: 'operations.pest',    nameAr: 'مكافحة الآفات',    nameEn: 'Pest Control',        parent: 'operations' },
    { key: 'safety',           nameAr: 'السلامة',           nameEn: 'Safety',           parent: null },
    { key: 'safety.fire',      nameAr: 'إطفاء الحريق',      nameEn: 'Fire Safety',      parent: 'safety' },
    { key: 'regulatory',       nameAr: 'التنظيمي',           nameEn: 'Regulatory',       parent: null },
    { key: 'regulatory.municipality', nameAr: 'البلدية', nameEn: 'Municipality', parent: 'regulatory' },
    { key: 'regulatory.sfda',  nameAr: 'الغذاء والدواء',    nameEn: 'SFDA',             parent: 'regulatory' },
    { key: 'training',         nameAr: 'التدريب',           nameEn: 'Training',         parent: null },
  ];
  const knCatByKey = new Map<string, { id: string; path: string }>();
  for (const spec of knowledgeCategorySpecs) {
    const [existing] = await db
      .select({ id: knowledgeCategories.id, path: knowledgeCategories.path })
      .from(knowledgeCategories)
      .where(and(eq(knowledgeCategories.companyId, company.id), eq(knowledgeCategories.key, spec.key)))
      .limit(1);
    if (existing) {
      knCatByKey.set(spec.key, existing);
      continue;
    }
    const parent = spec.parent ? knCatByKey.get(spec.parent) : null;
    const path = parent ? `${parent.path}/${spec.key.split('.').pop()}` : spec.key;
    const depth = parent ? path.split('/').length - 1 : 0;
    const [created] = await db
      .insert(knowledgeCategories)
      .values({
        companyId: company.id,
        parentId: parent?.id ?? null,
        key: spec.key,
        nameAr: spec.nameAr,
        nameEn: spec.nameEn,
        path,
        depth,
        isSystem: false,
      })
      .returning({ id: knowledgeCategories.id, path: knowledgeCategories.path });
    knCatByKey.set(spec.key, created);
  }
  console.log(`  ✓ ${knowledgeCategorySpecs.length} knowledge categories seeded`);

  const knArticleSpecs = [
    {
      key: 'sop.walkin_cooler_temp',
      categoryKey: 'food_safety.haccp',
      kind: 'sop' as const,
      titleAr: 'إجراءات مراقبة درجة حرارة غرفة التبريد',
      titleEn: 'Walk-in Cooler Temperature Monitoring SOP',
      summaryEn: 'Check walk-in cooler temperature (0–4°C) twice daily and log the reading.',
      summaryAr: 'قِس درجة حرارة غرفة التبريد (0–4°م) مرتين يومياً وسجّل القراءة.',
      bodyMd: `# Walk-in Cooler Temperature Monitoring

## Frequency
Twice daily — morning (before opening) and afternoon (2 pm).

## Steps
1. Open the cooler and let temperature stabilize for 30 seconds.
2. Read the built-in thermometer at eye level.
3. Cross-check with a calibrated hand thermometer at the middle shelf.
4. Log the reading in RCOS under the CCP monitoring task.

## Critical Limits
- **Target**: 0–4°C
- **Action level**: > 5°C → immediate corrective action

## Corrective Actions
If reading > 5°C:
1. Move perishable items to the backup cooler.
2. Check gasket seal, condenser fan, thermostat setting.
3. Escalate to Branch Manager and Food Safety Officer.
4. Log the incident in the CCP monitoring form and create an inspection follow-up task.`,
      tags: ['haccp', 'ccp', 'temperature', 'walk-in cooler'],
      references: [
        { authority: 'HACCP', ref: 'Codex Alimentarius CAC/RCP 1-1969', note: 'Principle 3: Establish critical limits' },
        { authority: 'SFDA', ref: 'GSO 993:2015', note: 'Food safety storage requirements' },
      ],
      links: [
        { targetType: 'asset_category' as const, targetRef: 'refrigeration.walk_in_cooler', label: 'Walk-in Cooler category' },
        { targetType: 'inspection_template' as const, targetRef: 'municipality_kitchen_v1', label: 'Municipality Kitchen Inspection' },
        { targetType: 'task_template' as const, targetRef: 'walkin_cooler_monthly', label: 'Monthly maintenance' },
        { targetType: 'compliance_framework' as const, targetRef: 'haccp', label: 'HACCP framework' },
      ],
    },
    {
      key: 'sop.shawarma_ccp',
      categoryKey: 'food_safety.haccp',
      kind: 'sop' as const,
      titleAr: 'مراقبة نقطة التحكم الحرجة للشاورما',
      titleEn: 'Shawarma CCP Monitoring SOP',
      summaryEn: 'Verify shawarma cone core temperature ≥75°C during peak service.',
      summaryAr: 'تحقّق من درجة حرارة قلب مخروط الشاورما (≥75°م) خلال الذروة.',
      bodyMd: `# Shawarma CCP — Cone Core Temperature

Cone core temperature must reach **≥75°C** for at least 15 seconds during service. This is a **critical control point** for pathogen kill-step (Salmonella, Campylobacter).

## Monitoring
- Insert calibrated probe into the thickest part of the cone.
- Record twice: at start of lunch service (12:00) and dinner service (18:00).

## Critical Limit
- ≥75°C internal temperature

## Deviations
Any reading <75°C triggers:
1. Continue cooking until target is reached.
2. Move shaved meat off the cone until it is safe.
3. Log the deviation with photo of thermometer reading.
4. Create a critical CAPA task and escalate to Food Safety Officer.`,
      tags: ['haccp', 'ccp', 'shawarma', 'critical'],
      references: [
        { authority: 'SFDA', ref: 'SFDA-FD-020', note: 'Poultry cooking temperatures' },
        { authority: 'HACCP', ref: 'Codex Alimentarius CAC/RCP 1-1969', note: 'Principle 4: Establish monitoring' },
      ],
      links: [
        { targetType: 'asset_category' as const, targetRef: 'cooking.shawarma_machine', label: 'Shawarma Machine category' },
        { targetType: 'task_template' as const, targetRef: 'shawarma_ccp_daily', label: 'Daily CCP task' },
        { targetType: 'compliance_framework' as const, targetRef: 'haccp', label: 'HACCP framework' },
      ],
    },
    {
      key: 'ssop.handwashing',
      categoryKey: 'food_safety.ssop',
      kind: 'sop' as const,
      titleAr: 'إجراء غسل الأيدي',
      titleEn: 'Handwashing SSOP',
      summaryEn: 'Correct 20-second handwashing procedure per SFDA guidance.',
      summaryAr: 'إجراء غسل الأيدي الصحيح (20 ثانية) وفق دليل الغذاء والدواء.',
      bodyMd: `# Handwashing

## When
- Before starting any task
- After using restroom
- After handling raw meat/poultry/seafood
- After coughing/sneezing/eating/smoking

## How (20 seconds minimum)
1. Wet hands with warm running water
2. Apply soap and lather to wrists
3. Scrub between fingers and under nails
4. Rinse
5. Dry with single-use paper towel

## Verification
Random visual observation by supervisor daily.`,
      tags: ['ssop', 'hygiene', 'training'],
      references: [
        { authority: 'SFDA', ref: 'Personal Hygiene Guide 2023' },
      ],
      links: [
        { targetType: 'area_kind' as const, targetRef: 'kitchen', label: 'All kitchen areas' },
        { targetType: 'compliance_framework' as const, targetRef: 'haccp', label: 'HACCP prerequisite program' },
      ],
    },
    {
      key: 'gmp.cleaning_schedule',
      categoryKey: 'operations.cleaning',
      kind: 'procedure' as const,
      titleAr: 'جدول التنظيف والتعقيم',
      titleEn: 'Cleaning & Sanitation Master Schedule',
      summaryEn: 'Daily / weekly / monthly cleaning tasks across all kitchen zones.',
      summaryAr: 'مهام التنظيف اليومية والأسبوعية والشهرية عبر جميع مناطق المطبخ.',
      bodyMd: `# Master Cleaning Schedule

## Daily
- Cook line surfaces after every service
- Slicer, mixer disassembly and sanitize
- Floor drains flush
- Three-compartment sink refill sanitizer every 2h

## Weekly
- Deep clean walk-in cooler shelves
- Hood filters
- Ice machine (if daily count high)

## Monthly
- Behind and under equipment
- Vent hood chemical clean by certified vendor

## Verification
Supervisor signs off; weekly ATP swab spot-check by QA.`,
      tags: ['gmp', 'cleaning', 'sanitation'],
      references: [
        { authority: 'SFDA', ref: 'GSO 1016:2015' },
      ],
      links: [
        { targetType: 'compliance_framework' as const, targetRef: 'municipality', label: 'Municipality' },
        { targetType: 'inspection_template' as const, targetRef: 'municipality_kitchen_v1', label: 'Municipality Kitchen Inspection' },
      ],
    },
    {
      key: 'policy.medical_certificates',
      categoryKey: 'food_safety',
      kind: 'policy' as const,
      titleAr: 'سياسة الشهادات الصحية للعاملين',
      titleEn: 'Employee Medical Certificates Policy',
      summaryEn: 'All food handlers must maintain a valid Saudi health card (renewed annually).',
      summaryAr: 'يجب على جميع العاملين في مناولة الأغذية الحصول على بطاقة صحية سارية (تُجدد سنوياً).',
      bodyMd: `# Medical Certificates

All food handlers must possess a valid Saudi health card at all times while on premise.

## Renewal
- Annual re-issue via approved medical center
- HR maintains centralized copies
- Expiry ≤30 days triggers a task for HR to schedule renewal

## Enforcement
Working without valid card is grounds for immediate suspension from food-handling duties.`,
      tags: ['policy', 'hygiene', 'compliance', 'sfda'],
      references: [{ authority: 'SFDA', ref: 'Personal Hygiene Guide 2023, §4' }],
      links: [
        { targetType: 'compliance_framework' as const, targetRef: 'sfda', label: 'SFDA' },
        { targetType: 'compliance_framework' as const, targetRef: 'municipality', label: 'Municipality' },
      ],
      requiresAcknowledgement: true,
    },
    {
      key: 'training.pest_awareness',
      categoryKey: 'training',
      kind: 'training_material' as const,
      titleAr: 'مادة تدريبية: الوعي بمكافحة الآفات',
      titleEn: 'Training: Pest Awareness',
      summaryEn: 'Signs of pests, reporting flow, and prevention basics.',
      summaryAr: 'علامات وجود الآفات، وسير التبليغ، وأساسيات الوقاية.',
      bodyMd: `# Pest Awareness Training

## What to look for
- Droppings near dry storage
- Grease trails along walls
- Live insects near drains, sinks
- Chewed packaging

## Report immediately
Any sighting → create a critical incident task and notify the Food Safety Officer within 30 min.

## Prevention basics
- Doors and windows sealed and screened
- No food left uncovered overnight
- Empty grease traps weekly
- Follow the cleaning master schedule`,
      tags: ['training', 'pest', 'awareness'],
      references: [],
      links: [
        { targetType: 'asset_category' as const, targetRef: 'pest_control', label: 'Pest control' },
      ],
    },
  ];

  for (const spec of knArticleSpecs) {
    const [existing] = await db
      .select({ id: knowledgeArticles.id })
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.companyId, company.id), eq(knowledgeArticles.key, spec.key)))
      .limit(1);
    if (existing) continue;

    const cat = knCatByKey.get(spec.categoryKey);
    const searchText = [spec.titleEn, spec.titleAr, spec.summaryEn, spec.summaryAr, spec.bodyMd, spec.tags.join(' ')].join(' ').toLowerCase();

    const [article] = await db
      .insert(knowledgeArticles)
      .values({
        companyId: company.id,
        categoryId: cat?.id ?? null,
        key: spec.key,
        kind: spec.kind,
        status: 'published',
        titleAr: spec.titleAr,
        titleEn: spec.titleEn,
        summaryAr: spec.summaryAr,
        summaryEn: spec.summaryEn,
        bodyMd: spec.bodyMd,
        tags: spec.tags,
        references: spec.references,
        requiresAcknowledgement: 'requiresAcknowledgement' in spec ? spec.requiresAcknowledgement : false,
        searchText,
        aiSummary: spec.summaryEn,
        aiMetadata: { kind: spec.kind, tags: spec.tags, referencesCount: spec.references.length, categoryKey: spec.categoryKey },
        publishedAt: new Date(),
      })
      .returning({ id: knowledgeArticles.id });

    await db.insert(knowledgeArticleVersions).values({
      companyId: company.id,
      articleId: article.id,
      version: 1,
      titleAr: spec.titleAr,
      titleEn: spec.titleEn,
      bodyMd: spec.bodyMd,
      changelog: 'Initial version (seed)',
    });

    for (const link of spec.links) {
      await db.insert(knowledgeArticleLinks).values({
        companyId: company.id,
        articleId: article.id,
        targetType: link.targetType,
        targetRef: link.targetRef,
        label: link.label,
      }).onConflictDoNothing();
    }
  }
  console.log(`  ✓ ${knArticleSpecs.length} knowledge articles seeded (published)`);

  /* -------------------------------------------------------------
   * Phase 6 — HACCP + Food Safety seed
   * ----------------------------------------------------------- */
  console.log('\n🌱 Seeding HACCP plan…');

  const [existingPlan] = await db
    .select({ id: haccpPlans.id })
    .from(haccpPlans)
    .where(and(eq(haccpPlans.companyId, company.id), eq(haccpPlans.reference, 'HACCP-SHW-001')))
    .limit(1);

  if (!existingPlan) {
    const [plan] = await db
      .insert(haccpPlans)
      .values({
        companyId: company.id,
        reference: 'HACCP-SHW-001',
        version: 1,
        titleAr: 'خطة الهاسب — الشاورما',
        titleEn: 'HACCP Plan — Shawarma',
        description: 'Complete HACCP plan for chicken shawarma production from receiving to service.',
        productDescription: 'Chicken shawarma prepared on vertical rotating spit, sliced and served in bread or platter.',
        intendedUse: 'General public, all age groups, ready-to-eat.',
        status: 'active',
        approvedAt: new Date().toISOString().slice(0, 10),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        reviewDueOn: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
        scopeProducts: [
          { nameEn: 'Chicken Shawarma', nameAr: 'شاورما دجاج', category: 'ready_to_eat' },
        ],
        scopeProcesses: ['receiving', 'storage_cold', 'prep', 'cooking', 'holding_hot', 'service'],
        teamMembers: [
          { name: 'Khalid Al-Harbi', role: 'Food Safety Officer', responsibilities: ['Plan owner', 'Hazard analysis', 'CCP monitoring'] },
          { name: 'Sara Al-Otaibi', role: 'Operations Director', responsibilities: ['Approval', 'Resource allocation'] },
          { name: 'Mohammed Al-Nakheli', role: 'Company Owner', responsibilities: ['Sign-off'] },
        ],
        prerequisitePrograms: ['ssop.handwashing', 'gmp.cleaning_schedule', 'pest_control_contract'],
        aiSummary: 'HACCP Plan for Chicken Shawarma — 2 CCPs (receiving temp + cook temp), 5 hazards.',
        aiMetadata: { productCount: 1, hazardCount: 5, ccpCount: 2 },
      })
      .returning();

    const hazardSpecs = [
      { type: 'biological' as const, stage: 'receiving' as const, titleEn: 'Salmonella / Campylobacter in raw chicken', titleAr: 'سالمونيلا / كامبيلوباكتر في الدجاج النيء', agent: 'Salmonella spp., Campylobacter', severity: 5, likelihood: 4, isCcp: true, ref: 'H-01', preventive: ['Approved suppliers only', 'Cold-chain verification on receipt'] },
      { type: 'biological' as const, stage: 'storage_cold' as const, titleEn: 'Bacterial growth if temperature > 4°C', titleAr: 'نمو بكتيري إذا تجاوزت الحرارة 4°م', agent: 'Various mesophiles', severity: 4, likelihood: 3, isCcp: false, ref: 'H-02', preventive: ['Twice-daily cooler temp checks', 'Preventive maintenance schedule'] },
      { type: 'biological' as const, stage: 'cooking' as const, titleEn: 'Pathogen survival if cone < 75°C', titleAr: 'بقاء المسببات المرضية إذا كانت درجة قلب المخروط < 75°م', agent: 'Salmonella spp.', severity: 5, likelihood: 3, isCcp: true, ref: 'H-03', preventive: ['Calibrated probe', 'Trained cook'] },
      { type: 'chemical' as const, stage: 'cleaning' as const, titleEn: 'Sanitizer residue on cutting surface', titleAr: 'بقايا المطهر على أسطح التقطيع', agent: 'Chlorine, quat', severity: 3, likelihood: 2, isCcp: false, ref: 'H-04', preventive: ['Rinse after sanitize', 'Test strip verification'] },
      { type: 'physical' as const, stage: 'prep' as const, titleEn: 'Foreign object (metal shaving) from slicer', titleAr: 'جسم غريب (شظية معدنية) من المقطعة', agent: 'Metal fragment', severity: 4, likelihood: 1, isCcp: false, ref: 'H-05', preventive: ['Blade condition check daily', 'Metal detector at final packaging'] },
    ];

    const insertedHazardIds: Record<string, string> = {};
    for (const h of hazardSpecs) {
      const riskScore = h.severity * h.likelihood;
      const [row] = await db
        .insert(hazards)
        .values({
          companyId: company.id,
          haccpPlanId: plan.id,
          type: h.type,
          stage: h.stage,
          titleAr: h.titleAr,
          titleEn: h.titleEn,
          agent: h.agent,
          severity: h.severity,
          likelihood: h.likelihood,
          riskScore,
          isSignificant: riskScore >= 8,
          reference: h.ref,
          preventiveMeasures: h.preventive,
          isCcp: h.isCcp,
          aiMetadata: { riskScore, type: h.type, stage: h.stage },
        })
        .returning({ id: hazards.id });
      insertedHazardIds[h.ref] = row.id;
    }

    // Locate the shawarma asset (may or may not exist depending on seed run order)
    const [shawarmaAsset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.companyId, company.id), eq(assets.code, 'SHW-01')))
      .limit(1);
    const [wicAsset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.companyId, company.id), eq(assets.code, 'WIC-01')))
      .limit(1);

    await db.insert(ccps).values({
      companyId: company.id,
      haccpPlanId: plan.id,
      assetId: wicAsset?.id ?? null,
      reference: 'CCP-01',
      number: 1,
      titleAr: 'التبريد المستمر لغرفة تبريد الدجاج',
      titleEn: 'Chicken cold storage temperature',
      stage: 'storage_cold',
      description: 'Walk-in cooler must hold raw chicken ≤ 4°C at all times.',
      hazardIds: [insertedHazardIds['H-01']],
      criticalLimits: [
        { metric: 'temp_c', op: 'lte', value: 4, unit: '°C', labelEn: 'Cooler temperature', labelAr: 'حرارة البراد' },
      ],
      monitoring: {
        frequency: 'twice_daily',
        method: 'probe_thermometer',
        responsibleRoleKey: 'branch_manager',
        procedureRef: 'sop.walkin_cooler_temp',
      },
      correctiveActionPlaybook: [
        { step: 'Move product to backup cooler', ownerRoleKey: 'branch_manager', deadlineMinutes: 30 },
        { step: 'Check gasket / condenser / thermostat', ownerRoleKey: 'operations_director' },
        { step: 'Log deviation and escalate to Food Safety Officer', ownerRoleKey: 'food_safety_officer' },
      ],
      verificationPlan: { frequency: 'weekly', method: 'record_review' },
    });

    await db.insert(ccps).values({
      companyId: company.id,
      haccpPlanId: plan.id,
      assetId: shawarmaAsset?.id ?? null,
      reference: 'CCP-02',
      number: 2,
      titleAr: 'حرارة قلب مخروط الشاورما',
      titleEn: 'Shawarma cone core temperature',
      stage: 'cooking',
      description: 'Cone core temperature must be ≥75°C during peak service.',
      hazardIds: [insertedHazardIds['H-03']],
      criticalLimits: [
        { metric: 'core_temp_c', op: 'gte', value: 75, unit: '°C', labelEn: 'Core temp', labelAr: 'حرارة القلب' },
      ],
      monitoring: {
        frequency: 'twice_per_service',
        method: 'probe_thermometer',
        responsibleRoleKey: 'food_safety_officer',
        procedureRef: 'sop.shawarma_ccp',
      },
      correctiveActionPlaybook: [
        { step: 'Continue cooking until ≥75°C reached', ownerRoleKey: 'employee' },
        { step: 'Discard shaved meat produced during deviation', ownerRoleKey: 'supervisor' },
        { step: 'Log with photo evidence + escalate to FSO', ownerRoleKey: 'food_safety_officer' },
      ],
      verificationPlan: { frequency: 'daily', method: 'record_review' },
    });

    console.log('  ✓ HACCP plan (SHW-001) seeded with 5 hazards and 2 CCPs');
  }

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
