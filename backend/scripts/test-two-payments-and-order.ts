import { BeneficiariesService } from '../src/modules/beneficiaries/beneficiaries.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { DeveloperDbExplorerService } from '../src/modules/developer/services/developer-db-explorer.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PaymentMode } from '../src/modules/common/enums';

async function main() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const auditService = new AuditService(prisma);
  const benService = new BeneficiariesService(prisma, auditService);
  const payService = new PaymentsService(prisma, auditService);
  const explorerService = new DeveloperDbExplorerService(prisma);

  const targetId = '2632a6d8-ce0e-410d-b4ff-29db20f72870';
  console.log(`Starting Two Payments Recording Test for: ${targetId}`);

  // Fetch installments for this beneficiary
  const billing = await benService.getBeneficiaryBilling(targetId);
  const bill = billing.developmentBills[0];
  if (!bill) throw new Error('No bill found!');

  const inst1 = bill.installments.find((i: any) => i.installment_number === 1);
  const inst2 = bill.installments.find((i: any) => i.installment_number === 2);
  if (!inst1 || !inst2) throw new Error('Installments 1 and 2 not found!');

  // Check if payments already exist
  const existingPayments = await prisma.payment.findMany({ where: { beneficiary_id: targetId } });
  console.log(`Existing payments in DB: ${existingPayments.length}`);

  if (existingPayments.length < 2) {
    // Record Payment 1: ₹2,500 CASH
    console.log('Recording Payment 1: ₹2,500 CASH for Installment 1...');
    const p1 = await payService.recordPayment(
      {
        beneficiaryId: targetId,
        installmentId: inst1.installment_id,
        amount: 2500,
        paymentMode: PaymentMode.CASH,
        referenceNumber: 'CASH-REC-001',
        notes: 'Initial Milestone Payment #1',
      },
      'DEV_ADMIN'
    );
    console.log(`Payment 1 created: Receipt #${p1.receipt_number}, ID: ${p1.payment_id}`);

    // Record Payment 2: ₹20,000 CASH
    console.log('Recording Payment 2: ₹20,000 CASH for Installment 2...');
    const p2 = await payService.recordPayment(
      {
        beneficiaryId: targetId,
        installmentId: inst2.installment_id,
        amount: 20000,
        paymentMode: PaymentMode.CASH,
        referenceNumber: 'CASH-REC-002',
        notes: 'Milestone Payment #2',
      },
      'DEV_ADMIN'
    );
    console.log(`Payment 2 created: Receipt #${p2.receipt_number}, ID: ${p2.payment_id}`);
  }

  // 1. Verify directly in SQLite DB
  const dbPayments = await prisma.payment.findMany({
    where: { beneficiary_id: targetId },
    orderBy: { created_at: 'asc' },
  });
  console.log(`\nSQLite Database Count: ${dbPayments.length} payment rows:`);
  for (const p of dbPayments) {
    console.log(`  - [${p.receipt_number}] Amount: ₹${p.amount}, Status: ${p.status}, Mode: ${p.payment_mode}`);
  }

  if (dbPayments.length < 2) {
    throw new Error(`DB verification failed: Expected at least 2 payments, found ${dbPayments.length}`);
  }

  // 2. Verify Payments Service Endpoint (Directly opening Payments tab)
  console.log('\nTesting direct Payments tab data retrieval...');
  const payTabResult = await benService.getBeneficiaryPayments(targetId);
  console.log(`Payments tab items count: ${payTabResult.items.length}`);
  console.log(`Payments tab development bills attached: ${payTabResult.developmentBills?.length}`);
  console.log(`Payments tab installments attached: ${payTabResult.installments?.length}`);

  if (payTabResult.items.length !== dbPayments.length) {
    throw new Error(`Mismatch between DB payments (${dbPayments.length}) and Payments tab items (${payTabResult.items.length})!`);
  }

  // 3. Verify Overview Summary
  console.log('\nTesting Beneficiary Overview calculations...');
  const overview = await benService.getBeneficiaryOverview(targetId);
  console.log(`Overview Total Paid: ₹${overview.metrics.totalPaid}`);
  console.log(`Overview Pending Balance: ₹${overview.metrics.pendingBalance}`);

  if (overview.metrics.totalPaid !== '22500') {
    throw new Error(`Expected totalPaid 22500, got ${overview.metrics.totalPaid}`);
  }
  if (overview.metrics.pendingBalance !== '77500') {
    throw new Error(`Expected pendingBalance 77500, got ${overview.metrics.pendingBalance}`);
  }

  // 4. Test Developer Relationship Inspector
  console.log('\nTesting Developer Relationship Inspector...');
  const rel = await explorerService.getBeneficiaryRelationshipSummary(targetId);
  console.log(`Inspector Payments Total: ${rel[0].payments.total}`);
  console.log(`Inspector Installments Total: ${rel[0].installments?.total}`);
  console.log(`Inspector Bills Total: ${rel[0].bills.total}`);

  console.log('\n====================================================');
  console.log('✓ TWO PAYMENTS PERSISTENCE AND INDEPENDENT ACCESS VERIFIED');
  console.log('====================================================');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
