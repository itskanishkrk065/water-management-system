const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const dbPath = path.join(__dirname, '..', 'prisma', 'template.db');
console.log('Opening SQLite database at:', dbPath);

function runSql(sql) {
  return cp.execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

const preCountRaw = runSql('SELECT count(*), sum(amount_due), sum(amount_paid), sum(pending_amount) FROM running_bills');
console.log('Pre-migration running bills (count|due|paid|pending):', preCountRaw);

const prePaymentsRaw = runSql('SELECT count(*), sum(amount) FROM payments WHERE running_bill_id IS NOT NULL');
console.log('Pre-migration running bill payments (count|sum):', prePaymentsRaw);

const sqlScript = `
BEGIN TRANSACTION;

-- 1. Create billing_periods table
CREATE TABLE IF NOT EXISTS "billing_periods" (
  "billing_period_id" TEXT NOT NULL PRIMARY KEY,
  "period_code" TEXT NOT NULL,
  "period_start" DATETIME NOT NULL,
  "period_end" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "collection_start_date" DATETIME NOT NULL,
  "collection_end_date" DATETIME NOT NULL,
  "payment_due_date" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_periods_period_code_key" ON "billing_periods"("period_code");
CREATE INDEX IF NOT EXISTS "billing_periods_status_idx" ON "billing_periods"("status");
CREATE INDEX IF NOT EXISTS "billing_periods_period_start_idx" ON "billing_periods"("period_start");
CREATE INDEX IF NOT EXISTS "billing_periods_period_end_idx" ON "billing_periods"("period_end");

-- 2. Create water_usage_records table
CREATE TABLE IF NOT EXISTS "water_usage_records" (
  "usage_id" TEXT NOT NULL PRIMARY KEY,
  "beneficiary_id" TEXT NOT NULL,
  "allotment_id" TEXT NOT NULL,
  "infrastructure_id" TEXT,
  "billing_period_id" TEXT NOT NULL,
  "collection_agent_id" TEXT,
  "usage_period_start" DATETIME NOT NULL,
  "usage_period_end" DATETIME NOT NULL,
  "collection_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actual_usage_litres" DECIMAL NOT NULL,
  "approved_litres_snapshot" DECIMAL NOT NULL,
  "usage_entry_mode" TEXT NOT NULL DEFAULT 'DIRECT',
  "previous_meter_reading" DECIMAL,
  "current_meter_reading" DECIMAL,
  "running_rate_snapshot" DECIMAL NOT NULL,
  "tariff_id" TEXT,
  "tariff_version" TEXT,
  "calculated_amount" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "notes" TEXT,
  "verified_at" DATETIME,
  "verified_by" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "water_usage_records_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries" ("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "water_usage_records_allotment_id_fkey" FOREIGN KEY ("allotment_id") REFERENCES "water_allotments" ("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "water_usage_records_infrastructure_id_fkey" FOREIGN KEY ("infrastructure_id") REFERENCES "infrastructure" ("infrastructure_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "water_usage_records_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("billing_period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "water_usage_records_collection_agent_id_fkey" FOREIGN KEY ("collection_agent_id") REFERENCES "users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "water_usage_records_allotment_id_billing_period_id_key" ON "water_usage_records"("allotment_id", "billing_period_id");
CREATE INDEX IF NOT EXISTS "water_usage_records_beneficiary_id_idx" ON "water_usage_records"("beneficiary_id");
CREATE INDEX IF NOT EXISTS "water_usage_records_billing_period_id_idx" ON "water_usage_records"("billing_period_id");
CREATE INDEX IF NOT EXISTS "water_usage_records_status_idx" ON "water_usage_records"("status");
CREATE INDEX IF NOT EXISTS "water_usage_records_collection_date_idx" ON "water_usage_records"("collection_date");

-- 3. Create system_clock_state table
CREATE TABLE IF NOT EXISTS "system_clock_state" (
  "state_id" TEXT NOT NULL PRIMARY KEY,
  "last_known_timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_rollback_detected" BOOLEAN NOT NULL DEFAULT 0,
  "rollback_detected_at" DATETIME,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
`;

runSql(sqlScript);

// Add columns if they do not exist
const colInfo = runSql('PRAGMA table_info(running_bills);');
if (!colInfo.includes('billing_period_id')) {
  runSql('ALTER TABLE "running_bills" ADD COLUMN "billing_period_id" TEXT;');
}
if (!colInfo.includes('usage_id')) {
  runSql('ALTER TABLE "running_bills" ADD COLUMN "usage_id" TEXT;');
}
if (!colInfo.includes('actual_usage_litres_snapshot')) {
  runSql('ALTER TABLE "running_bills" ADD COLUMN "actual_usage_litres_snapshot" DECIMAL;');
}
if (!colInfo.includes('is_legacy')) {
  runSql('ALTER TABLE "running_bills" ADD COLUMN "is_legacy" BOOLEAN NOT NULL DEFAULT 0;');
}
if (!colInfo.includes('legacy_classification')) {
  runSql('ALTER TABLE "running_bills" ADD COLUMN "legacy_classification" TEXT;');
}

const postAlterSql = `
BEGIN TRANSACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "running_bills_usage_id_key" ON "running_bills"("usage_id");
CREATE INDEX IF NOT EXISTS "running_bills_billing_period_id_idx" ON "running_bills"("billing_period_id");
CREATE INDEX IF NOT EXISTS "running_bills_is_legacy_idx" ON "running_bills"("is_legacy");

-- 5. Mark existing running bills as legacy valid financial data
UPDATE "running_bills"
SET "is_legacy" = 1,
    "legacy_classification" = 'LEGACY_VALID_FINANCIAL_DATA'
WHERE "is_legacy" = 0 OR "is_legacy" IS NULL;

-- 6. Insert initial calendar billing periods
INSERT OR IGNORE INTO "billing_periods" ("billing_period_id", "period_code", "period_start", "period_end", "status", "collection_start_date", "collection_end_date", "payment_due_date")
VALUES
  ('bp-2026-05', '2026-05', '2026-05-01 00:00:00', '2026-05-31 23:59:59', 'CLOSED', '2026-06-01 00:00:00', '2026-06-07 23:59:59', '2026-06-15 23:59:59'),
  ('bp-2026-09', '2026-09', '2026-09-01 00:00:00', '2026-09-30 23:59:59', 'CLOSED', '2026-10-01 00:00:00', '2026-10-07 23:59:59', '2026-10-15 23:59:59'),
  ('bp-2026-10', '2026-10', '2026-10-01 00:00:00', '2026-10-31 23:59:59', 'OPEN',   '2026-11-01 00:00:00', '2026-11-07 23:59:59', '2026-11-15 23:59:59'),
  ('bp-2026-11', '2026-11', '2026-11-01 00:00:00', '2026-11-30 23:59:59', 'UPCOMING', '2026-12-01 00:00:00', '2026-12-07 23:59:59', '2026-12-15 23:59:59'),
  ('bp-2026-12', '2026-12', '2026-12-01 00:00:00', '2026-12-31 23:59:59', 'UPCOMING', '2027-01-01 00:00:00', '2027-01-07 23:59:59', '2027-01-15 23:59:59');

-- Fallback for special legacy codes like 2026-Q3Q4, 2026-Q3Q4-SPLIT
INSERT OR IGNORE INTO "billing_periods" ("billing_period_id", "period_code", "period_start", "period_end", "status", "collection_start_date", "collection_end_date", "payment_due_date")
VALUES
  ('bp-2026-q3q4', '2026-Q3Q4', '2026-07-01 00:00:00', '2026-12-31 23:59:59', 'CLOSED', '2027-01-01 00:00:00', '2027-01-07 23:59:59', '2027-01-15 23:59:59'),
  ('bp-2026-q3q4-split', '2026-Q3Q4-SPLIT', '2026-07-01 00:00:00', '2026-12-31 23:59:59', 'CLOSED', '2027-01-01 00:00:00', '2027-01-07 23:59:59', '2027-01-15 23:59:59');

-- Link running_bills.billing_period_id
UPDATE "running_bills"
SET "billing_period_id" = (
  SELECT "billing_period_id" FROM "billing_periods"
  WHERE "billing_periods"."period_code" = "running_bills"."billing_period"
)
WHERE "billing_period_id" IS NULL;

-- 7. Initialize system clock state
INSERT OR IGNORE INTO "system_clock_state" ("state_id", "last_known_timestamp", "is_rollback_detected")
VALUES ('clock-singleton', CURRENT_TIMESTAMP, 0);

COMMIT;
`;

runSql(postAlterSql);
console.log('Migration executed successfully!');

const postCountRaw = runSql('SELECT count(*), sum(amount_due), sum(amount_paid), sum(pending_amount) FROM running_bills');
console.log('Post-migration running bills (count|due|paid|pending):', postCountRaw);

const postPaymentsRaw = runSql('SELECT count(*), sum(amount) FROM payments WHERE running_bill_id IS NOT NULL');
console.log('Post-migration running bill payments (count|sum):', postPaymentsRaw);

if (preCountRaw !== postCountRaw) {
  throw new Error('FINANCIAL INVARIANT VIOLATION: Running bills numbers changed!');
}
if (prePaymentsRaw !== postPaymentsRaw) {
  throw new Error('FINANCIAL INVARIANT VIOLATION: Payments changed!');
}

console.log('All financial invariants verified! 100% Match.');
console.log('PRAGMA integrity_check:', runSql('PRAGMA integrity_check;'));

runSql('PRAGMA wal_checkpoint(TRUNCATE);');
console.log('WAL Checkpointed cleanly.');
process.exit(0);

