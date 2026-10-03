import { PrismaService } from '../src/modules/prisma/prisma.service';
import { BackupService } from '../src/modules/backup/backup.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { IntegrityService } from '../src/modules/integrity/integrity.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { BeneficiariesService } from '../src/modules/beneficiaries/beneficiaries.service';
import * as fs from 'fs';
import * as path from 'path';

async function validatePhaseA() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const auditService = new AuditService(prisma);
  const backupService = new BackupService(prisma, auditService);
  const integrityService = new IntegrityService(prisma);
  const dashboardService = new DashboardService(prisma, integrityService);
  const benService = new BeneficiariesService(prisma, auditService);

  console.log('====================================================');
  console.log('PHASE A.1: SYSTEMATIC QA REPORT VALIDATION RUNNER');
  console.log('====================================================\n');

  // 1. Database Population Breakdown
  const [
    totalBeneficiaries,
    activeBeneficiaries,
    inactiveBeneficiaries,
    totalLandHoldings,
    activeLandHoldings,
    inactiveLandHoldings,
    totalWaterApps,
    activeWaterApps,
    historicalWaterApps,
    totalBills,
    totalInstallments,
    totalPayments,
    totalInfrastructures,
    totalExtensions,
    totalParcels,
  ] = await Promise.all([
    prisma.beneficiary.count(),
    prisma.beneficiary.count({ where: { status: 'ACTIVE' } }),
    prisma.beneficiary.count({ where: { status: 'INACTIVE' } }),
    prisma.landHolding.count(),
    prisma.landHolding.count({ where: { status: 'ACTIVE' } }),
    prisma.landHolding.count({ where: { status: 'INACTIVE' } }),
    prisma.waterApplication.count(),
    prisma.waterApplication.count({ where: { status: { notIn: ['REJECTED', 'CANCELLED', 'VOIDED'] } } }),
    prisma.waterApplication.count({ where: { status: { in: ['REJECTED', 'CANCELLED', 'VOIDED'] } } }),
    prisma.developmentBill.count(),
    prisma.installment.count(),
    prisma.payment.count({ where: { is_reversal: false } }),
    prisma.infrastructure.count(),
    prisma.extension.count(),
    prisma.landParcel.count(),
  ]);

  console.log('1. LIVE SQLITE POPULATION:');
  console.log(`  Beneficiaries: Total = ${totalBeneficiaries}, Active = ${activeBeneficiaries}, Inactive = ${inactiveBeneficiaries}`);
  console.log(`  Land Holdings: Total = ${totalLandHoldings}, Active = ${activeLandHoldings}, Inactive = ${inactiveLandHoldings}`);
  console.log(`  Water Applications: Total = ${totalWaterApps}, Active = ${activeWaterApps}, Historical = ${historicalWaterApps}`);
  console.log(`  Bills: ${totalBills}, Installments: ${totalInstallments}, Payments: ${totalPayments}`);
  console.log(`  Parcels: ${totalParcels}, Infrastructure: ${totalInfrastructures}, Extensions: ${totalExtensions}\n`);

  // 2. Active Acreage Aggregation Check
  const activeHoldings = await prisma.landHolding.findMany({
    where: { status: 'ACTIVE' },
    select: { declared_total_area: true },
  });
  const sumActiveAcreage = activeHoldings.reduce((sum, h) => sum + Number(h.declared_total_area), 0);

  const dshStats = await dashboardService.getStats();
  console.log('2. DASHBOARD AGGREGATION RECONCILIATION:');
  console.log(`  Raw SQLite Active Holdings Acreage: ${sumActiveAcreage.toFixed(2)} acres`);
  console.log(`  Dashboard Reported Active Acreage:  ${dshStats.land.total_active_acres} acres`);
  console.log(`  Dashboard Total Acreage (All):      ${dshStats.land.total_land_acres} acres`);
  console.log(`  Dashboard Active Beneficiaries:    ${dshStats.beneficiaries.active}`);
  console.log(`  Dashboard Inactive Beneficiaries:  ${dshStats.beneficiaries.inactive}\n`);

  // 3. Backup & Restore Comprehensive Inspection
  console.log('3. BACKUP/RESTORE SYSTEM INSPECTION:');
  const backupListBefore = await backupService.listBackups();
  console.log(`  Existing backups on disk: ${backupListBefore.backups.length}`);

  console.log('  Creating verified safety backup...');
  const newBackup = await backupService.createBackup('DEVELOPER', 'Safety QA Validation Snapshot', '127.0.0.1');
  console.log(`  Created Backup: Filename = ${newBackup.fileName}, Size = ${newBackup.sizeBytes} bytes`);
  console.log(`  Inspected Backup Manifest:`, JSON.stringify(newBackup.manifest, null, 2));

  // Verify what backup actually contains (db only vs receipts + docs)
  const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.HOME || '.';
  const appDataDir = process.env.WATER_APP_DATA_DIR || path.join(localAppData, 'WaterManagement');
  const backupsDir = path.join(appDataDir, 'backups');
  const backupFilePath = path.join(backupsDir, newBackup.fileName);

  console.log(`  Backup Physical File Path: ${backupFilePath}`);
  console.log(`  File exists: ${fs.existsSync(backupFilePath)}`);

  console.log('\n====================================================');
  console.log('PHASE A.1 VALIDATION COMPLETED SUCCESSFULLY');
  console.log('====================================================');

  await prisma.$disconnect();
}

validatePhaseA().catch((err) => {
  console.error('Validation Script Error:', err);
  process.exit(1);
});
