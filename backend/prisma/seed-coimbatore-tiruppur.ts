import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

export async function importCoimbatoreAndTiruppur() {
  console.log('--- Importing Location Master for Coimbatore & Tiruppur Exclusively ---');

  const excelPath = path.resolve(__dirname, '../../village_eng1.xls');
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel source file not found at: ${excelPath}`);
  }

  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[] = xlsx.utils.sheet_to_json(sheet);

  // Filter only Coimbatore and Tiruppur
  const targetRows = rawRows.filter((r) => {
    const dName = String(r['District Name'] || '').trim().toUpperCase();
    return dName === 'COIMBATORE' || dName === 'TIRUPPUR';
  });

  console.log(`Found ${targetRows.length} rows for Coimbatore and Tiruppur in Excel.`);

  // 1. Collect unique Districts, Blocks, and Villages
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

  // 2. Upsert Districts
  const districtDbMap = new Map<number, string>();
  for (const d of districtsMap.values()) {
    const districtRecord = await prisma.district.upsert({
      where: { lgd_district_code: d.lgdCode },
      update: { name: d.name, is_active: true },
      create: {
        name: d.name,
        lgd_district_code: d.lgdCode,
        is_active: true,
      },
    });
    districtDbMap.set(d.lgdCode, districtRecord.district_id);
    console.log(`District Upserted: ${d.name} (LGD: ${d.lgdCode}) -> ID: ${districtRecord.district_id}`);
  }

  // 3. Upsert Blocks
  const blockDbMap = new Map<number, string>();
  for (const b of blocksMap.values()) {
    const districtId = districtDbMap.get(b.lgdDistrictCode)!;
    const blockRecord = await prisma.block.upsert({
      where: { lgd_block_code: b.lgdBlockCode },
      update: { name: b.name, district_id: districtId, is_active: true },
      create: {
        name: b.name,
        lgd_block_code: b.lgdBlockCode,
        district_id: districtId,
        is_active: true,
      },
    });
    blockDbMap.set(b.lgdBlockCode, blockRecord.block_id);
  }
  console.log(`Upserted ${blockDbMap.size} Blocks for Coimbatore & Tiruppur.`);

  // 4. Upsert Villages
  let villageCount = 0;
  for (const v of villagesList) {
    const blockId = blockDbMap.get(v.lgdBlockCode);
    if (!blockId) continue;

    await prisma.village.upsert({
      where: { lgd_village_code: v.lgdVillageCode },
      update: { name: v.name, block_id: blockId, is_active: true },
      create: {
        name: v.name,
        lgd_village_code: v.lgdVillageCode,
        block_id: blockId,
        is_active: true,
      },
    });
    villageCount++;
  }
  console.log(`Upserted ${villageCount} Villages for Coimbatore & Tiruppur.`);

  // 5. Clean up any other districts/blocks/villages not in Coimbatore or Tiruppur
  const validDistrictIds = Array.from(districtDbMap.values());
  const validBlockIds = Array.from(blockDbMap.values());

  // Update any beneficiaries referencing non-Coimbatore/Tiruppur to the first valid village/block/district
  const defaultDistrictId = districtDbMap.get(523)!; // Coimbatore
  const defaultBlock = await prisma.block.findFirst({ where: { district_id: defaultDistrictId } });
  const defaultVillage = await prisma.village.findFirst({ where: { block_id: defaultBlock?.block_id } });

  if (defaultBlock && defaultVillage) {
    await prisma.beneficiary.updateMany({
      where: {
        OR: [
          { district_id: { notIn: validDistrictIds } },
          { block_id: { notIn: validBlockIds } },
        ],
      },
      data: {
        district_id: defaultDistrictId,
        block_id: defaultBlock.block_id,
        village_id: defaultVillage.village_id,
      },
    });
  }

  // Delete villages not in valid blocks
  const delVillages = await prisma.village.deleteMany({
    where: {
      block_id: { notIn: validBlockIds },
    },
  });
  console.log(`Cleaned up ${delVillages.count} other village records.`);

  // Delete blocks not in valid districts
  const delBlocks = await prisma.block.deleteMany({
    where: {
      district_id: { notIn: validDistrictIds },
    },
  });
  console.log(`Cleaned up ${delBlocks.count} other block records.`);

  // Nullify legacy panchayat_id on villages and beneficiaries
  await prisma.village.updateMany({ data: { panchayat_id: null } });
  await prisma.beneficiary.updateMany({ data: { panchayat_id: null } });

  // Delete legacy panchayats not in valid districts
  const delPanchayats = await prisma.panchayat.deleteMany({
    where: {
      district_id: { notIn: validDistrictIds },
    },
  });
  console.log(`Cleaned up ${delPanchayats.count} other panchayat records.`);

  // Delete other districts
  const delDistricts = await prisma.district.deleteMany({
    where: {
      district_id: { notIn: validDistrictIds },
    },
  });
  console.log(`Cleaned up ${delDistricts.count} other district records.`);

  console.log('--- Coimbatore & Tiruppur Isolation Complete ---');
}

if (require.main === module) {
  importCoimbatoreAndTiruppur()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
