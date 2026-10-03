# WATERGRID V2 — DISASTER RECOVERY RUNBOOK
**Authoritative Operational Procedures for Central PostgreSQL & Local Client Backup, Recovery, and Financial Re-Anchoring**

---

## 1. BACKUP ARCHITECTURE & RETENTION POLICIES

WaterGrid implements a two-tiered disaster recovery topology:
1. **Tier 1 (Central PostgreSQL Database)**: Authoritative state across all synchronized districts and offices.
2. **Tier 2 (Local Edge Client SQLite Database)**: Resilient offline node cache with pending mutation outbox.

```
       ┌────────────────────────────────────────────────────────┐
       │             TIER 1: CENTRAL POSTGRESQL                 │
       ├──────────────────────────┬─────────────────────────────┤
       │ Full Backup Frequency    │ Daily at 02:00 UTC          │
       │ Continuous Archiving     │ WAL streaming every 15 mins │
       │ Format                   │ Custom compressed (-F c)    │
       │ Encryption               │ OpenSSL AES-256-CBC         │
       │ Retention                │ 30 days daily, 7 yrs annual │
       │ Off-site Storage         │ Encrypted S3 / Remote Vault │
       └──────────────────────────┴─────────────────────────────┘

       ┌────────────────────────────────────────────────────────┐
       │             TIER 2: CLIENT OFFLINE SQLITE              │
       ├──────────────────────────┬─────────────────────────────┤
       │ Backup Format            │ .wmbak (Encrypted ZIP+WAL)  │
       │ Trigger                  │ Automated pre-reset & on-dem│
       │ Local Storage            │ %LOCALAPPDATA%/backups      │
       │ Recovery Scope           │ DB + Outbox + Local Receipts│
       └──────────────────────────┴─────────────────────────────┘
```

---

## 2. CENTRAL POSTGRESQL BACKUP AUTOMATION

### Automated Cron Job Configuration
Add to `/etc/cron.d/watergrid-backup`:
```bash
# Execute daily encrypted PostgreSQL backup at 02:00 UTC
0 2 * * * ubuntu /opt/watergrid/backend/scripts/backup-postgres.sh >> /var/log/watergrid-backup.log 2>&1

# Prune local backups older than 30 days
0 3 * * * ubuntu find /opt/watergrid/backend/backups/postgres -name "watergrid_backup_*.dump*" -mtime +30 -delete
```

### Off-Site Backup Replication
```bash
# Sync encrypted archives to remote S3 bucket
aws s3 sync /opt/watergrid/backend/backups/postgres/ s3://watergrid-backups-secure/postgres/ \
  --sse aws:kms \
  --exclude "*.dump" \
  --include "*.enc" \
  --include "*.sha256"
```

---

## 3. FULL CENTRAL RESTORATION PROCEDURE (SCENARIO: HOST LOSS)

### Step 1: Provision Clean Database & Prerequisites
```bash
# On new host, verify PostgreSQL 16 is running
sudo -u postgres psql -c "CREATE DATABASE water_management_prod;"
```

### Step 2: Retrieve & Decrypt Latest Backup
```bash
cd /opt/watergrid/backend

# Verify checksum before decryption
shasum -a 256 -c backups/postgres/watergrid_backup_prod_20261003_020000.sha256

# Restore archive using automated script
./scripts/restore-postgres.sh \
  backups/postgres/watergrid_backup_prod_20261003_020000.dump.enc \
  water_management_prod
```

### Step 3: Execute Financial Invariant Reconciliation Verification
Execute the automated post-restore verification suite:
```bash
DATABASE_URL="postgresql://water_admin:****@localhost:5432/water_management_prod" \
npx ts-node scripts/test-disaster-recovery.ts
```
**Acceptance Criteria**:
* All table row counts match source backup.
* Financial discrepancy delta is exactly **₹0.00**.

---

## 4. LOCAL CLIENT SQLITE RESTORATION PROCEDURE

When a field laptop suffers disk failure or SQLite database corruption:

1. **Locate Latest Archive**:
   Archives are named `WaterManagement_Backup_<TIMESTAMP>.wmbak` in `%LOCALAPPDATA%\WaterManagement\backups`.
2. **Execute Restoration**:
   * Open WaterGrid Desktop.
   * Navigate to `Settings -> System Diagnostics -> Backup & Restore`.
   * Select latest `.wmbak` file and click `Restore Backup`.
   * Alternatively, trigger via API:
     ```bash
     curl -X POST http://127.0.0.1:4000/api/v1/backup/restore \
       -H "Authorization: Bearer $ADMIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"fileName": "WaterManagement_Backup_20261003.wmbak", "reason": "Hardware replacement recovery"}'
     ```
3. **Outbox Integrity & Synchronization Resume**:
   * Pending operations in `sync_outbox` (`status: PENDING`) are preserved in the `.wmbak` snapshot.
   * Upon restarting the app, `ClientSyncWorkerService` reconnects and resumes draining the outbox sequentially.
   * Central server evaluates idempotency (`clientOpId`); operations previously received return `ALREADY_ACCEPTED` with zero double-charging.

---

## 5. POINT-IN-TIME RECOVERY (PITR) RUNBOOK

In the event of an accidental administrative truncation:
1. Stop the application server: `sudo systemctl stop watergrid-backend`.
2. Restore the baseline base backup to the target data directory.
3. Configure `recovery.signal` and `postgresql.conf`:
   ```ini
   restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
   recovery_target_time = '2026-10-03 14:15:00 UTC'
   recovery_target_action = 'promote'
   ```
4. Start PostgreSQL to replay WAL logs up to the exact recovery target time.
5. Execute financial integrity verification: `npx ts-node scripts/test-disaster-recovery.ts`.
6. Restart application server: `sudo systemctl start watergrid-backend`.

---

## 6. DISASTER RECOVERY TEAM ROLES & ESCALATION MATRIX

| Role | Responsibility | Contact SLA |
| :--- | :--- | :--- |
| **Incident Commander** | Declares disaster, coordinates restore sequence, authorizes DB promotion | < 15 minutes |
| **Database Administrator** | Executes `restore-postgres.sh` and WAL replay | < 30 minutes |
| **Financial Auditor** | Validates ledger consistency; confirms ₹0.00 variance before release | < 45 minutes |
| **Field Operations Lead** | Communicates with field officers; pauses client syncing during restore | < 20 minutes |
