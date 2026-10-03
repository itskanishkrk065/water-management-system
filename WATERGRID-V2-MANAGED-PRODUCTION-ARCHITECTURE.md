# WATERGRID V2 — MANAGED PRODUCTION ARCHITECTURE (NEON + RENDER)
**Authoritative Architectural Specification for Cloud-Managed PostgreSQL, Serverless API Hosting, and Resilient Edge Electron Nodes**

---

## 1. ARCHITECTURAL TOPOLOGY & CORE ROLES

WaterGrid V2 implements a hybrid cloud-and-edge distributed architecture designed for rural infrastructure resilience with centralized state authority:

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                 CENTRAL CLOUD RUNTIME                   │
                              │                                                         │
                              │   ┌─────────────────────────────────────────────────┐   │
                              │   │          RENDER MANAGED WEB SERVICE             │   │
                              │   │        NestJS REST Monolith API Engine          │   │
                              │   │    - TLS 1.3 / HTTPS Ingress                    │   │
                              │   │    - Dynamic Port & 0.0.0.0 Binding             │   │
                              │   │    - /api/v1/health & Readiness Probes          │   │
                              │   │    - RBAC Authorization & Audit Engine          │   │
                              │   └───────────────────────┬─────────────────────────┘   │
                              │                           │ Prisma (PgBouncer Pooler)   │
                              │                           ▼                             │
                              │   ┌─────────────────────────────────────────────────┐   │
                              │   │             NEON MANAGED POSTGRESQL             │   │
                              │   │          Authoritative Production Store         │   │
                              │   │    - Authoritative Ledger & Rates               │   │
                              │   │    - Continuous Point-in-Time Recovery          │   │
                              │   │    - Versioned Migrations (prisma migrate)      │   │
                              │   └─────────────────────────────────────────────────┘   │
                              └───────────────────────────▲─────────────────────────────┘
                                                          │
                                         HTTPS / TLS 1.3  │  REST API Calls & Sync Batches
                                         (/api/v1/sync)   │  (Idempotent & Ordered)
                                                          │
   ┌──────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┐
   │                                     FIELD LAPTOP NODES (ELECTRON RUNTIME)                                   │
   │                                                                                                             │
   │   ┌───────────────────────────────┐     ┌───────────────────────────────┐     ┌─────────────────────────┐   │
   │   │       NEXT.JS FRONTEND        │     │     ELECTRON MAIN PROCESS     │     │   EMBEDDED SQLITE WAL   │   │
   │   │  Tailwind / Shadcn UI Engine  │◄───►│  - OS SafeStorage (DPAPI/Key) │◄───►│  - Local Client Cache   │   │
   │   │  - Configurable Base URL      │ IPC │  - Hardware Device Identity   │ IPC │  - Durable Sync Outbox  │   │
   │   │  - Sync Center Dashboard      │     │  - Child Process Orchestration│     │  - PRAGMA FK = ON       │   │
   │   └───────────────────────────────┘     └───────────────────────────────┘     └─────────────────────────┘   │
   └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Authoritative Responsibility Declarations
* **NEON**: Authoritative PostgreSQL database. Sole master source of financial truth, master rates, and verified ledger transactions.
* **RENDER**: Managed application/API host. Manages process lifecycle, TLS termination, horizontal auto-scaling, and health probes without self-hosted Nginx/PM2/systemd.
* **ELECTRON SQLITE**: First-class local and offline persistence engine. Runs SQLite 3.45 in WAL mode with active foreign key enforcement.
* **SYNC OUTBOX**: Durable FIFO queue residing inside local SQLite, recording local mutations with monotonic sequence numbers.
* **SYNC ENGINE**: Bidirectional delta-synchronization engine ensuring idempotent delivery, echo suppression, and deterministic conflict routing.
* **SERVER**: Sole financial authority. Client-side financial calculations are treated as unverified advisory previews; the server calculates and seals authoritative bills and payment allocations.

---

## 2. MODES OF OPERATION & DATA FLOW

### A. Online Mode (Connected to Render)
1. Electron client detects internet connectivity and connects to the Render API (`https://<render-subdomain>.onrender.com/api/v1`).
2. Read operations execute directly against the local cache or stream fresh deltas from the server.
3. Mutations (new applications, payments, meter readings) are written to local SQLite and simultaneously enqueued in the `sync_outbox`.
4. The background `ClientSyncWorkerService` immediately drains outbox envelopes to `POST /api/v1/sync/push` on Render.
5. Render API executes the mutation against Neon PostgreSQL inside a database transaction (`$transaction`), updates aggregate versions, and commits the state.
6. The client receives the server confirmation and marks the outbox item `COMMITTED`.

### B. Offline Mode (Deep Rural / Disconnected)
1. When cellular or Wi-Fi network drops, the Electron client automatically transitions to **OFFLINE 🟠**.
2. All business workflows remain operational:
   * Beneficiary search and registration.
   * Land holding and subdivision survey records.
   * Water usage recording and reading capture.
   * Offline payment collection.
3. Payments recorded offline generate printed/onscreen receipts watermarked:
   `[OFFLINE RECEIPT — PENDING CENTRAL CONFIRMATION]`.
4. Mutations are committed to local SQLite and appended to `sync_outbox` with status `PENDING`.
5. The local application continues running smoothly with zero crashes or modal blocking.

### C. Reconnection & Convergence (Offline $\rightarrow$ Online)
1. Network restored; client transitions to **SYNCING 🔵**.
2. `ClientSyncWorkerService` queries pending items from `sync_outbox` ordered by `sequence_number ASC`.
3. Outbox envelopes are transmitted to Render in batches.
4. Render processes each operation idempotently:
   * Checks `client_op_id` in `sync_operations` table.
   * If already processed, returns `ALREADY_ACCEPTED` without re-executing.
   * If aggregate version matches, commits mutation and returns `APPLIED`.
   * If aggregate version is stale, routes to conflict detection or overpayment advance ledger.
5. Client receives confirmation, marks outbox `COMMITTED`, and pulls server deltas (`GET /api/v1/sync/pull`).
6. Echo suppression ensures mutations created by this device are not re-applied locally.
7. Status indicator turns **ONLINE 🟢**.

---

## 3. FINANCIAL INTEGRITY & CONFLICT RESOLUTION RULES

### Invariant 1: Single Rate Formula
$$\text{Actual Usage (Litres)} \times \text{Tariff Rate (₹/Litre)} = \text{Authoritative Amount Due}$$
Zero usage equals zero bill. No arbitrary standing charges without water infrastructure.

### Invariant 2: Overpayment Advance Ledger Routing
In concurrent payment scenarios where two devices collect payments against the same bill:
* Device A collects ₹7,000 offline against a ₹10,000 bill.
* Device B collects ₹6,000 online against the same ₹10,000 bill.
* Device B commits first: Outstanding balance becomes ₹4,000.
* Device A syncs subsequently:
  * ₹4,000 is applied to fully satisfy the bill (Balance = ₹0.00).
  * The ₹3,000 excess is **NEVER silently dropped or rejected**.
  * The server automatically routes ₹3,000 into `beneficiary_advance_ledgers` as a credit balance for future billing periods.
  * Zero double-counting, zero paisa loss, zero negative balance.

---

## 4. SECURITY BOUNDARIES & HARDENING DIRECTIVES

1. **Least-Privilege Database Access**:
   * Application runs with a restricted PostgreSQL user (`water_app`) with DML privileges only.
   * DDL migrations (`prisma migrate deploy`) use the unpooled `DIRECT_URL` with administrative credentials.
2. **Zero Database Credentials on Clients**:
   * Electron desktop installations NEVER possess `DATABASE_URL` or database credentials.
   * Electron communicates exclusively over HTTPS with the Render API.
3. **OS SafeStorage Credential Vault**:
   * JWT access and refresh tokens are encrypted at rest using Windows DPAPI / macOS Keychain.
   * No unencrypted authentication tokens are stored in `localStorage` in desktop mode.
4. **Canonical Document Sandbox (Phase Q)**:
   * Document uploads sanitize file names and strictly verify containment within the server's canonical storage root.
   * Path traversal sequences (`../`, absolute drive paths, UNC paths) are rejected with HTTP 400.
5. **Production Developer Portal Lockout**:
   * Database reset and clean-slate operations are permanently disabled in production mode.
   * Hardcoded bypass keys are eradicated.

---

## 5. DISASTER RECOVERY & RECONCILIATION

* **Neon Point-in-Time Recovery**: Continuous WAL archiving allows restoration to any second in the retention window.
* **Local Offline Backups**: Local SQLite databases and pending outbox queues can be backed up as encrypted `.wmbak` archives without losing un-synced field mutations.
* **Automated Financial Reconciliation**: Tested and verified on live databases; restore procedures enforce exact matching of development bills, running bills, and payment ledgers with **₹0.00 discrepancy**.

---

## 6. PRODUCTION DEPLOYMENT & MIGRATION PROCEDURES

### Step 1: Neon Database Provisioning
1. Create a Neon Project on PostgreSQL 16 (AWS `ap-southeast-1` or `eu-central-1`).
2. Obtain:
   * **Pooled Connection String** (`DATABASE_URL`): `postgresql://[user]:[pass]@[host]-pooler.neon.tech/[db]?sslmode=require`
   * **Direct Connection String** (`DIRECT_URL`): `postgresql://[user]:[pass]@[host].neon.tech/[db]?sslmode=require`

### Step 2: Render Web Service Provisioning
1. Connect Git repository to Render.
2. Select **Web Service**, runtime **Node**.
3. Configure:
   * **Build Command**: `cd backend && npm ci && npm run build:render`
   * **Start Command**: `cd backend && npm run start:prod`
   * **Health Check Path**: `/api/v1/health`
4. Set Environment Variables:
   * `NODE_ENV=production`
   * `DATABASE_URL=<Neon Pooled URL>`
   * `DIRECT_URL=<Neon Direct URL>`
   * `JWT_SECRET=<Auto-generated 64-char string>`
   * `JWT_REFRESH_SECRET=<Auto-generated 64-char string>`
   * `CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000`

### Step 3: Execute Versioned Database Migration
```bash
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Step 4: Configure Electron Desktop Client
Set the production API URL during packaging or via environment:
```bash
WATERGRID_API_URL=https://watergrid-api.onrender.com/api/v1
```
The client connects to Render when online, and continues running seamlessly on local SQLite when offline.
