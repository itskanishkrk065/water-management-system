import { Client } from 'pg';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Decimal } from 'decimal.js';

/**
 * WATERGRID V2 — PHASE 11: DISASTER RECOVERY & FINANCIAL RECONCILIATION TEST
 * Executes:
 * STAGING DATABASE -> BACKUP -> RESTORE INTO TEST DB -> FINANCIAL INVARIANT RECONCILIATION
 */
async function runDisasterRecoveryVerification() {
  console.log('================================================================');
  console.log('WATERGRID V2: FULL DISASTER RECOVERY & RESTORE AUDIT');
  console.log('================================================================');

  const sourceDb = 'water_management_staging';
  const targetDb = 'water_management_dr_test';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'water_admin';
  const password = process.env.DB_PASSWORD || 'water_secret_pass';

  const sourceClient = new Client({ host, port, user, password, database: sourceDb });
  const rootClient = new Client({ host, port, user, password, database: 'water_management' });

  await sourceClient.connect();
  await rootClient.connect();

  console.log(`[DR Audit] 1. Gathering pre-backup financial metrics from '${sourceDb}'...`);

  // Query source metrics
  const countQuery = `
    SELECT 
      (SELECT count(*) FROM beneficiaries) as ben_count,
      (SELECT count(*) FROM land_holdings) as land_count,
      (SELECT count(*) FROM water_applications) as app_count,
      (SELECT count(*) FROM water_allotments) as allot_count,
      (SELECT count(*) FROM development_bills) as dev_bill_count,
      (SELECT count(*) FROM installments) as inst_count,
      (SELECT count(*) FROM running_bills) as run_bill_count,
      (SELECT count(*) FROM payments) as pay_count,
      (SELECT count(*) FROM audit_logs) as audit_count
  `;
  const financialQuery = `
    SELECT
      coalesce(sum(total_amount), 0) as dev_due,
      coalesce(sum(amount_paid), 0) as dev_paid,
      coalesce(sum(pending_amount), 0) as dev_pending
    FROM development_bills;
  `;
  const runningFinancialQuery = `
    SELECT
      coalesce(sum(amount_due), 0) as run_due,
      coalesce(sum(amount_paid), 0) as run_paid,
      coalesce(sum(pending_amount), 0) as run_pending
    FROM running_bills;
  `;
  const paymentQuery = `
    SELECT coalesce(sum(amount), 0) as total_payments
    FROM payments WHERE is_reversal = false;
  `;

  const srcCounts = (await sourceClient.query(countQuery)).rows[0];
  const srcFin = (await sourceClient.query(financialQuery)).rows[0];
  const srcRunFin = (await sourceClient.query(runningFinancialQuery)).rows[0];
  const srcPay = (await sourceClient.query(paymentQuery)).rows[0];

  console.log(`[DR Audit]    Source Development Bills Total: ₹${new Decimal(srcFin.dev_due).toFixed(2)}`);
  console.log(`[DR Audit]    Source Running Bills Total:     ₹${new Decimal(srcRunFin.run_due).toFixed(2)}`);
  console.log(`[DR Audit]    Source Payments Accounted:      ₹${new Decimal(srcPay.total_payments).toFixed(2)}`);

  // 2. Prepare target clean database
  console.log(`[DR Audit] 2. Preparing clean target recovery database '${targetDb}'...`);
  await rootClient.query(`DROP DATABASE IF EXISTS ${targetDb};`);
  await rootClient.query(`CREATE DATABASE ${targetDb};`);

  // 3. Take pg_dump snapshot using docker exec
  const dumpFile = path.join('/tmp', `dr_test_${Date.now()}.dump`);
  console.log(`[DR Audit] 3. Executing pg_dump to '${dumpFile}'...`);
  execSync(
    `docker exec water_postgres pg_dump -U ${user} -d ${sourceDb} -F c -b -f /tmp/watergrid_dr_snapshot.dump`,
    { stdio: 'inherit' },
  );

  // 4. Restore into target database
  console.log(`[DR Audit] 4. Executing pg_restore into '${targetDb}'...`);
  execSync(
    `docker exec water_postgres pg_restore -U ${user} -d ${targetDb} --clean --if-exists --no-owner --no-acl /tmp/watergrid_dr_snapshot.dump || true`,
    { stdio: 'inherit' },
  );

  // 5. Connect to restored target database and query metrics
  console.log(`[DR Audit] 5. Connecting to restored database '${targetDb}' to verify integrity...`);
  const targetClient = new Client({ host, port, user, password, database: targetDb });
  await targetClient.connect();

  const tgtCounts = (await targetClient.query(countQuery)).rows[0];
  const tgtFin = (await targetClient.query(financialQuery)).rows[0];
  const tgtRunFin = (await targetClient.query(runningFinancialQuery)).rows[0];
  const tgtPay = (await targetClient.query(paymentQuery)).rows[0];

  // 6. Detailed comparison & assertion
  console.log('----------------------------------------------------------------');
  console.log('RESTORATION RECONCILIATION VERIFICATION:');
  console.log('----------------------------------------------------------------');

  const checkTable = (name: string, src: any, tgt: any) => {
    const s = parseInt(src, 10);
    const t = parseInt(tgt, 10);
    const match = s === t;
    console.log(`  Table ${name.padEnd(20)}: Source=${s}, Restored=${t} -> ${match ? 'MATCH ✓' : 'MISMATCH ✗'}`);
    if (!match) throw new Error(`Row count mismatch in table ${name}: Source=${s}, Restored=${t}`);
  };

  checkTable('beneficiaries', srcCounts.ben_count, tgtCounts.ben_count);
  checkTable('land_holdings', srcCounts.land_count, tgtCounts.land_count);
  checkTable('water_applications', srcCounts.app_count, tgtCounts.app_count);
  checkTable('water_allotments', srcCounts.allot_count, tgtCounts.allot_count);
  checkTable('development_bills', srcCounts.dev_bill_count, tgtCounts.dev_bill_count);
  checkTable('installments', srcCounts.inst_count, tgtCounts.inst_count);
  checkTable('running_bills', srcCounts.run_bill_count, tgtCounts.run_bill_count);
  checkTable('payments', srcCounts.pay_count, tgtCounts.pay_count);
  checkTable('audit_logs', srcCounts.audit_count, tgtCounts.audit_count);

  console.log('----------------------------------------------------------------');
  console.log('FINANCIAL RECONCILIATION:');
  console.log('----------------------------------------------------------------');

  const checkMoney = (name: string, src: any, tgt: any) => {
    const s = new Decimal(src);
    const t = new Decimal(tgt);
    const delta = s.minus(t).abs();
    console.log(`  ${name.padEnd(28)}: Source=₹${s.toFixed(2)}, Restored=₹${t.toFixed(2)} (Delta: ₹${delta.toFixed(2)})`);
    if (!delta.isZero()) throw new Error(`Financial discrepancy in ${name}: Delta is ₹${delta.toFixed(2)}`);
  };

  checkMoney('Development Billed', srcFin.dev_due, tgtFin.dev_due);
  checkMoney('Development Paid', srcFin.dev_paid, tgtFin.dev_paid);
  checkMoney('Development Pending', srcFin.dev_pending, tgtFin.dev_pending);
  checkMoney('Running Billed', srcRunFin.run_due, tgtRunFin.run_due);
  checkMoney('Running Paid', srcRunFin.run_paid, tgtRunFin.run_paid);
  checkMoney('Running Pending', srcRunFin.run_pending, tgtRunFin.run_pending);
  checkMoney('Total Valid Payments', srcPay.total_payments, tgtPay.total_payments);

  // 7. Cleanup
  console.log('----------------------------------------------------------------');
  console.log('[DR Audit] 6. Cleaning up test database and temporary dump file...');
  await targetClient.end();
  await sourceClient.end();
  await rootClient.query(`DROP DATABASE IF EXISTS ${targetDb};`);
  await rootClient.end();
  execSync('docker exec water_postgres rm -f /tmp/watergrid_dr_snapshot.dump', { stdio: 'ignore' });

  console.log('================================================================');
  console.log('✓ DISASTER RECOVERY & FINANCIAL RECONCILIATION: 100% PASS');
  console.log('  Financial Discrepancy Delta: ₹0.00 (Zero paisa loss)');
  console.log('================================================================');
}

runDisasterRecoveryVerification().catch((err) => {
  console.error('[DR Audit Fatal Error]:', err.message);
  process.exit(1);
});
