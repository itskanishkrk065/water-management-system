import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Universal SQLite Seeding for Offline Desktop App...');

  // 1. Seed Roles
  const roles = [
    { name: 'ADMIN' as const, description: 'System Administrator with full operational governance' },
    { name: 'FIELD_OFFICER' as const, description: 'Field staff managing farmer land verification and applications' },
    { name: 'ACCOUNTS' as const, description: 'Financial officer managing development payments and reversals' },
    { name: 'VIEWER' as const, description: 'Read-only access for audits and reports' },
    { name: 'BENEFICIARY' as const, description: 'Farmer self-service portal account' },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { name: r.name as any },
      update: { description: r.description },
      create: { name: r.name as any, description: r.description },
    });
    roleMap[r.name] = roleRecord.role_id;
  }
  console.log('✓ Roles initialized');

  // 2. Seed Default Administrator
  const adminEmail = 'admin@water.gov.in';
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { is_active: true },
    create: {
      email: adminEmail,
      password_hash: passwordHash,
      full_name: 'System Administrator',
      role_id: roleMap['ADMIN'],
      is_active: true,
    },
  });
  console.log(`✓ Admin user initialized (${adminUser.email})`);

  // 3. Seed Default Project
  const project = await prisma.project.upsert({
    where: { project_code: 'KB-IRR-2026' },
    update: { project_name: 'Kongu Basin Sustainable Irrigation Scheme 2026' },
    create: {
      project_code: 'KB-IRR-2026',
      project_name: 'Kongu Basin Sustainable Irrigation Scheme 2026',
      description: 'Coimbatore & Tiruppur regional water distribution & farmer allotment network',
      status: 'ACTIVE',
      start_date: new Date('2026-01-01'),
    },
  });
  console.log(`✓ Project initialized: ${project.project_name}`);

  // 4. Seed Rate Tariff Configuration (₹0.05/L dev, ₹0.01/L running, 10,000 L/acre)
  const existingRate = await prisma.rateConfiguration.findFirst({
    where: { project_id: project.project_id, is_active: true },
  });

  if (!existingRate) {
    await prisma.rateConfiguration.create({
      data: {
        project_id: project.project_id,
        litres_per_acre: 10000,
        development_cost_per_litre: 0.05,
        running_cost_per_litre: 0.01,
        effective_from: new Date('2026-01-01'),
        is_active: true,
        created_by: adminUser.user_id,
      },
    });
    console.log('✓ Rate tariff initialized (₹0.05/L dev, 10,000 L/acre)');
  }

  // 5. Seed 5-Stage Installment Template
  const existingTemplate = await prisma.installmentTemplate.findFirst({
    where: { project_id: project.project_id },
  });

  if (!existingTemplate) {
    await prisma.installmentTemplate.create({
      data: {
        project_id: project.project_id,
        name: 'Standard 5-Stage Agricultural Water Scheme (2.5% - 20% - 25% - 25% - 27.5%)',
        inst_1_pct: 2.5,
        inst_2_pct: 20.0,
        inst_3_pct: 25.0,
        inst_4_pct: 25.0,
        inst_5_pct: 27.5,
        is_active: true,
        created_by: adminUser.user_id,
      },
    });
    console.log('✓ 5-Stage Installment template initialized');
  }

  // 6. Seed Location Master for Coimbatore & Tiruppur from Excel if present
  const excelPaths = [
    path.resolve(__dirname, '../../village_eng1.xls'),
    path.resolve(__dirname, '../village_eng1.xls'),
    path.resolve(process.cwd(), 'village_eng1.xls'),
  ];

  const excelPath = excelPaths.find((p) => fs.existsSync(p));

  if (excelPath) {
    console.log(`✓ Found location Excel at: ${excelPath}`);
    const wb = xlsx.readFile(excelPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet);

    const targetRows = rawRows.filter((r) => {
      const dName = String(r['District Name'] || '').trim().toUpperCase();
      return dName === 'COIMBATORE' || dName === 'TIRUPPUR';
    });

    console.log(`Importing ${targetRows.length} location records for Coimbatore & Tiruppur...`);

    const districtsMap = new Map<number, { name: string; lgdCode: number }>();
    const blocksMap = new Map<number, { name: string; lgdBlockCode: number; lgdDistrictCode: number }>();
    const villagesList: { name: string; lgdVillageCode: number; lgdBlockCode: number }[] = [];

    for (const r of targetRows) {
      const dCode = parseInt(r['LGD District Code'], 10);
      const dName = String(r['District Name']).trim();
      const bCode = parseInt(r['LGD Block code'], 10);
      const bName = String(r['Block Name']).trim();
      const vCode = parseInt(r['LGD Village Code'], 10);
      const vName = String(r['Village Name']).trim();

      if (!districtsMap.has(dCode)) {
        districtsMap.set(dCode, { name: dName, lgdCode: dCode });
      }

      if (!blocksMap.has(bCode)) {
        blocksMap.set(bCode, { name: bName, lgdBlockCode: bCode, lgdDistrictCode: dCode });
      }

      villagesList.push({ name: vName, lgdVillageCode: vCode, lgdBlockCode: bCode });
    }

    const districtDbMap = new Map<number, string>();
    for (const d of districtsMap.values()) {
      const districtRecord = await prisma.district.upsert({
        where: { lgd_district_code: d.lgdCode },
        update: { name: d.name, is_active: true },
        create: { name: d.name, lgd_district_code: d.lgdCode, is_active: true },
      });
      districtDbMap.set(d.lgdCode, districtRecord.district_id);
    }

    const blockDbMap = new Map<number, string>();
    for (const b of blocksMap.values()) {
      const districtId = districtDbMap.get(b.lgdDistrictCode);
      if (!districtId) continue;
      const blockRecord = await prisma.block.upsert({
        where: { lgd_block_code: b.lgdBlockCode },
        update: { name: b.name, district_id: districtId, is_active: true },
        create: { name: b.name, lgd_block_code: b.lgdBlockCode, district_id: districtId, is_active: true },
      });
      blockDbMap.set(b.lgdBlockCode, blockRecord.block_id);
    }

    for (const v of villagesList) {
      const blockId = blockDbMap.get(v.lgdBlockCode);
      if (!blockId) continue;
      await prisma.village.upsert({
        where: { lgd_village_code: v.lgdVillageCode },
        update: { name: v.name, block_id: blockId, is_active: true },
        create: { name: v.name, lgd_village_code: v.lgdVillageCode, block_id: blockId, is_active: true },
      });
    }

    console.log(`✓ Successfully seeded ${districtsMap.size} districts, ${blockDbMap.size} blocks, and ${villagesList.length} villages.`);
  } else {
    console.log('ℹ Location Excel file not found during seed run; skipping bulk village import.');
  }

  console.log('🚀 Universal SQLite Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
