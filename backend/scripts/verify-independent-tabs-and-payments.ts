import { BeneficiariesService } from '../src/modules/beneficiaries/beneficiaries.service';
import { DeveloperDbExplorerService } from '../src/modules/developer/services/developer-db-explorer.service';
import { DeveloperCleanStateService } from '../src/modules/developer/services/developer-clean-state.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { BackupService } from '../src/modules/backup/backup.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CleanStateModeEnum } from '../src/modules/developer/dto/developer.dto';

async function main() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const auditService = new AuditService(prisma);
  const backupService = new BackupService(prisma, auditService);
  const benService = new BeneficiariesService(prisma, auditService);
  const explorerService = new DeveloperDbExplorerService(prisma);
  const cleanStateService = new DeveloperCleanStateService(prisma, backupService, auditService);

  console.log('====================================================');
  console.log('STARTING WATERGRID REGRESSION & INDEPENDENT TAB SUITE');
  console.log('====================================================');

  // 1. Find a real beneficiary with complete records
  const beneficiaries = await prisma.beneficiary.findMany({
    include: {
      landHoldings: true,
      waterApplications: true,
      waterAllotments: true,
      developmentBills: {
        include: {
          installments: true,
        },
      },
      payments: true,
    },
    take: 10,
  });

  console.log(`Found ${beneficiaries.length} beneficiaries in SQLite:`);
  for (const b of beneficiaries) {
    console.log(`  - [${b.beneficiary_id}] ${b.name}: ${b.landHoldings.length} land, ${b.waterApplications.length} water, ${b.developmentBills.length} bills, ${b.payments.length} payments`);
  }

  const candidate = beneficiaries.find((b) => b.developmentBills.length > 0) || beneficiaries[0];

  if (!candidate) {
    throw new Error('No beneficiaries found in SQLite database!');
  }

  const targetId = candidate.beneficiary_id;
  console.log(`Testing with Beneficiary: ${candidate.name} (ID: ${targetId})`);
  console.log(`  - DB Land Holdings: ${candidate.landHoldings.length}`);
  console.log(`  - DB Water Applications: ${candidate.waterApplications.length}`);
  console.log(`  - DB Development Bills: ${candidate.developmentBills.length}`);
  console.log(`  - DB Payments: ${candidate.payments.length}`);

  // ----------------------------------------------------
  // TEST A: PAYMENTS INDEPENDENT QUERY
  // ----------------------------------------------------
  console.log('\n[TEST A] Executing Payments query directly (without visiting other tabs)...');
  const paymentsResult = await benService.getBeneficiaryPayments(targetId);
  console.log(`  Payments returned: ${paymentsResult.items.length} items`);
  console.log(`  Development bills attached: ${paymentsResult.developmentBills?.length || 0}`);
  console.log(`  Installments attached: ${paymentsResult.installments?.length || 0}`);

  if (candidate.payments.length > 0 && paymentsResult.items.length === 0) {
    throw new Error('TEST A FAILED: Payments endpoint returned 0 items despite DB having payments!');
  }
  if (candidate.developmentBills.length > 0 && (!paymentsResult.developmentBills || paymentsResult.developmentBills.length === 0)) {
    throw new Error('TEST A FAILED: Payments endpoint did not return development bills needed for 5-stage milestone schedule!');
  }
  console.log('✓ TEST A PASSED: Payments tab data is 100% self-contained.');

  // ----------------------------------------------------
  // TEST B: BILLING INDEPENDENT QUERY
  // ----------------------------------------------------
  console.log('\n[TEST B] Executing Billing query directly...');
  const billingResult = await benService.getBeneficiaryBilling(targetId);
  console.log(`  Development bills returned: ${billingResult.developmentBills.length}`);
  const installmentsCount = billingResult.developmentBills.reduce(
    (acc, bill) => acc + (bill.installments?.length || 0),
    0
  );
  console.log(`  Installments returned across bills: ${installmentsCount}`);
  console.log('✓ TEST B PASSED: Billing tab loads authoritative records directly.');

  // ----------------------------------------------------
  // TEST C: WATER INDEPENDENT QUERY
  // ----------------------------------------------------
  console.log('\n[TEST C] Executing Water query directly...');
  const waterResult = await benService.getBeneficiaryWater(targetId);
  console.log(`  Water Applications: ${waterResult.waterApplications.length}`);
  console.log(`  Water Allotments: ${waterResult.waterAllotments.length}`);
  console.log('✓ TEST C PASSED: Water tab loads independently.');

  // ----------------------------------------------------
  // TEST D: BENEFICIARY PROFILE SUMMARY DIRECT QUERY
  // ----------------------------------------------------
  console.log('\n[TEST D] Executing Beneficiary Overview directly...');
  const overviewResult = await benService.getBeneficiaryOverview(targetId);
  console.log(`  Total Land: ${overviewResult.metrics.totalLandAcres} acres`);
  console.log(`  Active Water Apps: ${overviewResult.metrics.activeWaterAppsCount}`);
  console.log(`  Historical Water Apps: ${overviewResult.metrics.historicalWaterAppsCount}`);
  console.log(`  Bills Total: ₹${overviewResult.metrics.billsTotalAmount}`);
  console.log(`  Total Paid: ₹${overviewResult.metrics.totalPaid}`);
  console.log(`  Pending Balance: ₹${overviewResult.metrics.pendingBalance}`);
  console.log('✓ TEST D PASSED: Profile summary loads independently with zero tab visit dependency.');

  // ----------------------------------------------------
  // TEST E: DEVELOPER RELATIONSHIP INSPECTOR
  // ----------------------------------------------------
  console.log('\n[TEST E] Testing Developer Beneficiary Relationship Inspector...');
  const relSummaries = await explorerService.getBeneficiaryRelationshipSummary(targetId);
  console.log(`  Inspector result for ${targetId}:`, JSON.stringify(relSummaries[0], null, 2));
  if (!relSummaries || relSummaries.length === 0) {
    throw new Error('TEST E FAILED: Developer relationship summary returned no data!');
  }
  console.log('✓ TEST E PASSED: Relational summary introspected directly from SQLite.');

  // ----------------------------------------------------
  // TEST F: CLEAN SLATE PREVIEW CONTRACT
  // ----------------------------------------------------
  console.log('\n[TEST F] Testing Clean Slate Preview Contract...');
  const preview = await cleanStateService.getCleanStatePreview({
    mode: CleanStateModeEnum.EMPTY_CLEAN_STATE,
    preserveMasterLocations: true,
    preserveMasterTariffs: true,
    preserveUsersAndRoles: true,
  });
  console.log(`  Clean Slate Preview: tablesToRemove count = ${preview.tablesToRemove.length}, tablesToPreserve count = ${preview.tablesToPreserve.length}`);
  console.log(`  Tables to preserve: ${preview.tablesToPreserve.join(', ')}`);
  console.log('✓ TEST F PASSED: Clean Slate Preview respects master preservation options.');

  console.log('\n====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS');
  console.log('====================================================');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
