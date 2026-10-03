# WATERGRID V2 — CURRENT-STATE OFFLINE ARCHITECTURE AUDIT & DISCOVERY

**Document ID:** `WATERGRID-V2-OFFLINE-CURRENT-STATE-ARCHITECTURE`  
**Version:** `1.0.0`  
**Classification:** Architectural Discovery & Current-State Audit (Phase 0 Baseline)  
**Date of Audit:** October 3, 2026  
**Status:** Authoritative Architectural Baseline — No Modifications Made to Codebase  
**Audited Target:** WaterGrid Desktop Application (Kongu Basin Water Allocation, Development Billing, Running Charges & Beneficiary Management System)

---

## 1. Executive Summary

WaterGrid V1 is fundamentally a **single-node, local-first offline desktop application**. Rather than utilizing an embedded browser storage engine (such as IndexedDB, RxDB, or WatermelonDB), the application's runtime topology is structured as a **self-contained desktop-hosted client-server environment**: an Electron shell that spawns a local Node.js NestJS backend on `127.0.0.1:4000` paired with an embedded SQLite database (`water_management.db`), alongside a local Next.js standalone frontend on `127.0.0.1:3000`.

The system's offline persistence is achieved because **the entire backend stack runs locally on the user's laptop**. However, the codebase was architected under the assumption of a **single authoritative local database file**. It currently lacks:
1. An asynchronous synchronization engine, local outbox table, or operational queue.
2. Cryptographic or versioned conflict detection (no monotonic entity versions or revision vectors).
3. Universal operation idempotency (idempotency checks exist solely as an ad-hoc filter in `PaymentsService`).
4. Strict database-level uniqueness constraints across critical parent-child relationships (e.g., duplicate water applications for the same land parcel rely on an in-memory Node.js `Set<string>` lock rather than a SQLite constraint).
5. Transaction-coupled audit logs (audit entries are written outside database transactions, risking audit omission during abrupt power loss).

This audit provides an exhaustive, evidence-backed inspection of every layer of the current application to serve as the definitive baseline for designing the V1 $\rightarrow$ V2 distributed online + offline synchronization architecture.

---

## 2. Repository Structure

The repository is organized as a multi-package workspace containing desktop orchestration, an API backend, a web frontend, and legacy mobile assets:

```text
/Volumes/It's Mine Too ,MF/Water/
├── package.json                   # Root package: electron & electron-builder orchestration
├── electron/
│   ├── main.js                    # Electron main process (spawner, health checks, storage)
│   └── preload.js                 # Electron preload script (narrow contextBridge)
├── backend/
│   ├── package.json               # NestJS dependencies (@nestjs/core, @prisma/client, decimal.js)
│   ├── tsconfig.json              # TypeScript compilation config
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL target schema (native enums)
│   │   ├── schema.sqlite.prisma   # Active SQLite schema (string enums, WAL, SQLite pragmas)
│   │   ├── template.db            # Initial seed template database (2.5 MB SQLite file)
│   │   └── seed-sqlite.ts         # SQLite seed script
│   ├── scripts/
│   │   └── patch-prisma-client.js # Post-generate script injecting JS enums into Prisma client
│   └── src/
│       ├── main.ts                # NestJS bootstrap (CORS, Pipes, Filters, Swagger)
│       ├── app.module.ts          # Root NestJS module importing 22 domain feature modules
│       └── modules/               # Domain feature modules (auth, billing, payments, water, etc.)
├── frontend/
│   ├── package.json               # Next.js 14 frontend dependencies (@tanstack/react-query, axios)
│   ├── next.config.mjs            # Next.js standalone build configuration
│   └── src/
│       ├── app/                   # Next.js App Router (layout, providers, routes)
│       ├── components/            # Reusable UI widgets and domain management views
│       └── lib/                   # API client (axios), auth context, developer API
├── dist/                          # Packaged desktop deliverables (DMG for macOS, NSIS for Win)
└── village_eng1.xls               # Official Tamil Nadu Revenue Village master reference dataset
```

---

## 3. Runtime Architecture

The runtime architecture of WaterGrid V1 operates as three isolated OS processes orchestrated by Electron:

```text
+-----------------------------------------------------------------------------------------------+
| ELECTRON DESKTOP SHELL (Process 1: Main Process)                                              |
| - Single Instance Lock (electron/main.js:48)                                                  |
| - AppData Resolver: %LOCALAPPDATA%/WaterManagement or ~/Library/Application Support (main.js:18)|
| - Process Supervisor: Spawns Backend & Frontend via utilityProcess.fork / child_process.fork   |
| - Health Check Gate: Polls http://127.0.0.1:4000/api/docs & http://127.0.0.1:3000/login       |
+-----------------------------------------------------------------------------------------------+
       |                                                                   |
       | Spawns with env (PORT: 3000)                                     | Spawns with env (PORT: 4000,
       v                                                                   |                  DATABASE_URL)
+------------------------------------+                             +----------------------------+
| FRONTEND PROCESS (Process 2)       |                             | BACKEND PROCESS (Process 3)|
| - Next.js Standalone (server.js)   |                             | - NestJS Modular Monolith  |
| - Host: 127.0.0.1:3000             |                             | - Host: 127.0.0.1:4000     |
| - Chromium Renderer in BrowserWindow| HTTP REST (Axios)           | - Prisma Client ORM        |
| - TanStack React Query (In-Memory) | --------------------------> | - Embedded SQLite Engine   |
| - Auth Tokens in LocalStorage      | Authorization: Bearer <JWT> | - WAL Journal Mode         |
+------------------------------------+                             +----------------------------+
                                                                                  |
                                                                                  | File I/O
                                                                                  v
                                                                   +----------------------------+
                                                                   | LOCAL FILESYSTEM STORE     |
                                                                   | %APPDATA%/WaterManagement/ |
                                                                   | ├── database/              |
                                                                   | │   └── water_management.db|
                                                                   | ├── backups/ (*.wmbak)     |
                                                                   | ├── logs/ (desktop.log)    |
                                                                   | └── documents/             |
                                                                   +----------------------------+
```

---

## 4. Process Boundaries

WaterGrid maintains three distinct operating system process boundaries:

| Process | Technology | Boundary Type | Communication Mechanism | Evidence |
|---|---|---|---|---|
| **Electron Main** | Electron / Node.js runtime | OS Process | Supervises child processes; IPC bridge to Chromium | `electron/main.js:1-10` |
| **Frontend UI** | Node.js (Next.js server) + Chromium | OS Process / Browser Context | HTTP requests to Backend; ContextBridge to Electron Main | `electron/main.js:321-349`, `frontend/src/lib/api.ts:1-20` |
| **Backend API** | Node.js (NestJS framework) | OS Process | HTTP REST on loopback interface (`127.0.0.1:4000`) | `backend/src/main.ts:44-48`, `electron/main.js:256-319` |
| **Database** | SQLite engine linked via Prisma | In-Process C-Library | SQLite C ABI embedded inside Prisma Query Engine binary | `backend/src/modules/prisma/prisma.service.ts:25-45` |

### Process Isolation Observations
1. **Network Binding**: Both backend and frontend bind strictly to `127.0.0.1`. The application cannot be reached from the local area network without explicit proxying.
2. **Crash Propagation**: If the NestJS child process crashes, the frontend does not crash; instead, Axios calls fail with `ECONNREFUSED`. Electron’s main process monitors child exit events (`child.on('exit')` in `electron/main.js:195-201`), capturing logs in `backendStderrLogs`.
3. **Shutdown Coupling**: Terminating the Electron window executes `app.on('before-quit')`, which calls `backendProcess.kill()` (`electron/main.js:640`). This is a hard SIGTERM without a graceful shutdown handshake to Prisma.

---

## 5. Electron Architecture

### 5.1 Storage Directory Resolution
Electron calculates the root data directory via `getAppDataDirectory()` (`electron/main.js:17-34`):
```javascript
const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || app.getPath('userData');
const appDataDir = path.join(localAppData, 'WaterManagement');
```
It ensures the presence of 7 system subdirectories: `database`, `documents`, `receipts`, `reports`, `backups`, `logs`, and `config`.

### 5.2 Template Database Initialization
Upon initial launch, Electron inspects `appDataDir/database/water_management.db`. If the file does not exist, it performs a bootstrap copy from the pre-seeded template (`electron/main.js:277-292`):
```javascript
if (!fs.existsSync(sqliteDbPath)) {
  fs.copyFileSync(foundTemplate, sqliteDbPath);
  logDesktop(`✓ Initialized fresh database from template: ${foundTemplate}`);
}
```

### 5.3 Preload Bridge & Security Baseline
Electron exposes a minimal API via `contextBridge` (`electron/preload.js:1-8`):
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openStorageFolder: () => ipcRenderer.invoke('app:open-storage-folder'),
  isDesktop: true,
});
```
* **Security Settings** (`electron/main.js:507-515`):
  - `contextIsolation: true` (Renderer cannot access Electron internal prototypes).
  - `nodeIntegration: false` (Renderer cannot call `require('fs')` or `child_process`).
  - `sandbox: false` (Required for standard Electron preload compatibility).
  - `webSecurity: true` (Default Chromium origin isolation).

---

## 6. Frontend Architecture

### 6.1 Framework & API Client
The frontend is built on **Next.js 14 App Router**. All data fetching communicates with `http://127.0.0.1:4000/api/v1` through a configured Axios singleton (`frontend/src/lib/api.ts:1-10`):
* An Axios request interceptor injects `Authorization: Bearer <water_access_token>` from `localStorage` (`api.ts:12-20`).
* An Axios response interceptor intercepts `401 Unauthorized` responses and attempts a single token refresh against `/auth/refresh` using `water_refresh_token` (`api.ts:22-54`).

### 6.2 Frontend State Management (TanStack React Query)
Global asynchronous state is managed via `@tanstack/react-query` (`frontend/src/app/providers.tsx:8-18`):
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  },
})
```
* **Critical Finding**: There is **no persistent cache** (no `idb-keyval`, `localStorage`, or `persistQueryClient`). The frontend state is an **in-memory HTTP cache**. Every page navigation or window reload refetches active data from the local NestJS backend.

---

## 7. Backend Architecture

The backend is a **NestJS Modular Monolith** (`backend/src/app.module.ts:1-53`) structured into 22 domain modules:
1. `PrismaModule`: Database connectivity and SQLite performance PRAGMAs.
2. `AuthModule`: Password verification, JWT generation, and token rotation.
3. `UsersModule` & `RolesModule`: User account and RBAC management.
4. `LocationsModule`: Districts, Blocks, Panchayats, Villages, and Excel LGD imports.
5. `ProjectsModule`: Kongu basin water project schemes.
6. `BeneficiariesModule`: Farmer registrations, contact details, and location linkages.
7. `LandModule`: Land holdings and Survey/Subdivision parcel management.
8. `RatesModule`: Tariff timeline, cost-per-litre rate configurations.
9. `WaterModule`: Water requirement applications and allotment approvals.
10. `BillingModule`: Monthly billing periods, water usage recording, and running bills.
11. `PaymentsModule`: Financial receipting, balance reductions, and reversals.
12. `InfrastructureModule`: Physical infrastructure milestones (Planned $\rightarrow$ Commissioned).
13. `ExtensionsModule`: Water quota expansion requests.
14. `DashboardModule`: Consolidated metric aggregation.
15. `BeneficiaryPortalModule`: Self-service portal endpoints.
16. `ReportsModule` & `ReportPreset`: Parametric report generation and export.
17. `BackupModule`: `.wmbak` archive generation and system restore.
18. `IntegrityModule`: Database consistency verification routines.
19. `SearchModule`: Global search indexing.
20. `DeveloperModule`: Diagnostic tools, clean-state protocol, and SQL explorer.
21. `AuditModule`: Centralized append-only audit event logging.
22. `ApplicationClockService`: Time tracking and clock rollback detection.

---

## 8. Database Architecture

### 8.1 SQLite Database Location & Path Resolution
The active database file path is resolved dynamically via `PrismaService` (`backend/src/modules/prisma/prisma.service.ts:9-23`):
* Environment variable: `DATABASE_URL` (passed by Electron as `file:<APPDATA>/WaterManagement/database/water_management.db`).
* Windows backslashes are normalized to forward slashes: `dbUrl = 'file:' + resolvedPath.replace(/\\/g, '/')`.

### 8.2 Engine Performance PRAGMAs
Upon initialization (`onModuleInit` in `prisma.service.ts:58-67`), the engine applies performance tuning PRAGMAs:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64 MB cache allocation
PRAGMA temp_store = MEMORY;
PRAGMA busy_timeout = 5000;  -- 5 second lock acquisition timeout
```

### 8.3 Foreign Key Enforcement Defect
* **Critical Finding**: `PRAGMA foreign_keys = ON;` is **absent** from `prisma.service.ts`! In SQLite, foreign key enforcement is disabled by default on raw connections. While the Prisma Query Engine enforces relations during standard queries, raw SQL executions or direct database writes bypass relational cascading and integrity rules.

---

## 9. Prisma Architecture & Model Audit

The schema (`backend/prisma/schema.sqlite.prisma`) defines **28 domain models**. Below is the exhaustive audit of all models:

| Model | Table Name | Primary Key | Key Unique Constraints | Indexes | Status / Lifecycle Fields | Financial Relevance | Sync Capability (V2) |
|---|---|---|---|---|---|---|---|
| `Role` | `roles` | `role_id` (UUID) | `name` | None | None | None | Master Data (Server authoritative) |
| `User` | `users` | `user_id` (UUID) | `email` | `role_id` | `is_active` | None | Master Data / Auth |
| `RefreshToken` | `refresh_tokens` | `token_id` (UUID) | `token_hash` | `user_id` | `revoked`, `expires_at` | None | Local Session (Do not sync) |
| `Project` | `projects` | `project_id` (UUID) | `project_code` | None | `status` | Indirect (rates link to project) | Master Data (Server authoritative) |
| `District` | `districts` | `district_id` (UUID) | `lgd_district_code` | `lgd_district_code`, `name` | `is_active` | None | Master Data |
| `Block` | `blocks` | `block_id` (UUID) | `lgd_block_code` | `district_id`, `lgd_block_code` | `is_active` | None | Master Data |
| `Panchayat` | `panchayats` | `panchayat_id` (UUID) | `[district_id, name]` | None | None | None | Master Data |
| `Village` | `villages` | `village_id` (UUID) | `lgd_village_code` | `block_id`, `panchayat_id`, `lgd_village_code` | `is_active` | None | Master Data |
| `LocationImport` | `location_imports` | `import_id` (UUID) | None | `uploaded_at`, `status` | `status` | None | Operational Audit (Local only) |
| `Beneficiary` | `beneficiaries` | `beneficiary_id` (UUID) | `phone_number`, `user_id` | `phone_number`, `district_id`, `status` | `status` | Indirect | High (Requires synchronization) |
| `LandHolding` | `land_holdings` | `land_id` (UUID) | None | `beneficiary_id`, `status`, `project_id` | `status` | Indirect (Basis for quota) | High (Requires synchronization) |
| `LandParcel` | `land_parcels` | `parcel_id` (UUID) | `[land_id, survey_number, subdivision_number]` | `land_id` | None | Indirect | High (Requires synchronization) |
| `RateConfiguration` | `rate_configurations` | `rate_id` (UUID) | None | `[project_id, effective_from]`, `is_active` | `is_active` | Direct (Rate per litre) | Master Data (Server authoritative) |
| `InstallmentTemplate`| `installment_templates`| `template_id` (UUID) | None | `project_id` | `is_active` | Direct (Milestone percentages)| Master Data (Server authoritative) |
| `WaterApplication` | `water_applications` | `application_id` (UUID)| None | `[beneficiary_id, status]`, `land_id` | `status` | Indirect | High (Requires synchronization) |
| `WaterAllotment` | `water_allotments` | `allotment_id` (UUID) | `application_id` | `beneficiary_id`, `rate_id` | `approval_status` | Direct (Approved quota) | High (Server authoritative) |
| `DevelopmentBill` | `development_bills` | `bill_id` (UUID) | `allotment_id` | `beneficiary_id`, `status` | `status` | Direct (₹ Total, Paid, Pending)| High (Immutable Financial) |
| `Installment` | `installments` | `installment_id` (UUID)| `[bill_id, installment_number]` | `[bill_id, status]`, `status` | `status` | Direct (Milestone balance) | High (Immutable Financial) |
| `Payment` | `payments` | `payment_id` (UUID) | `receipt_number` | `[beneficiary_id, payment_date]`, `status` | `status`, `is_reversal` | Direct (Cash received) | Critical (Requires idempotency) |
| `Infrastructure` | `infrastructure` | `infrastructure_id` | `allotment_id` | `beneficiary_id`, `status` | `status` | Direct (Running eligibility) | High (Requires synchronization) |
| `BillingPeriod` | `billing_periods` | `billing_period_id` | `period_code` | `status`, `period_start`, `period_end` | `status` | Direct (Billing calendar) | Master Data (Server authoritative) |
| `WaterUsageRecord` | `water_usage_records` | `usage_id` (UUID) | `[allotment_id, billing_period_id]` | `beneficiary_id`, `billing_period_id` | `status` | Direct (Drives running bill) | High (Offline field entry) |
| `RunningBill` | `running_bills` | `running_bill_id` | `bill_number`, `usage_id` | `allotment_id`, `beneficiary_id`, `status` | `status` | Direct (₹ Due, Paid, Pending) | Critical (Server authoritative) |
| `SystemClockState` | `system_clock_state` | `state_id` (UUID) | None | None | `is_rollback_detected` | Security (Tamper detection) | Local Hardware State |
| `Extension` | `extensions` | `extension_id` (UUID) | None | `beneficiary_id`, `original_allotment_id` | `status` | Direct (Additional charge) | High (Requires synchronization) |
| `AuditLog` | `audit_logs` | `audit_id` (UUID) | None | `[entity_type, entity_id]`, `action` | None | Audit (Append-only trail) | Append-Only Synchronization |
| `BeneficiaryDocument`| `beneficiary_documents`| `document_id` (UUID) | None | `[beneficiary_id, category]` | None | Indirect | Binary sync required |
| `ReportPreset` | `report_presets` | `preset_id` (UUID) | `name` | `category`, `is_active` | `is_active` | None | User Configuration |

---

## 10. Authentication Architecture

### 10.1 Login Flow
1. Client submits `{ email, password }` to `POST /api/v1/auth/login` (`auth.service.ts:32-39`).
2. `AuthService.validateUser()` fetches `User` including `Role` (`auth.service.ts:14-30`).
3. Verifies password hash via `bcrypt.compare(pass, user.password_hash)`.
4. Issues JWT access token (1 hour) and generates a database `RefreshToken` record (7 days) with token rotation (`auth.service.ts:210-264`).

### 10.2 Gaps & Weaknesses in Current Authentication
* **Hardcoded Secret Fallback**: `auth.service.ts:219` falls back to `'super-secret-jwt-key-for-water-management-v1-32chars'` if `JWT_SECRET` is undefined in the environment.
* **Storage Insecurity**: Tokens and user profile JSON are stored directly in browser `localStorage` (`frontend/src/lib/api.ts:14, 33` and `auth-context.tsx:54-56`), making them vulnerable to extraction if another script runs in renderer context.
* **No Device Identity**: The system has **no concept of device ID, hardware binding, or installation tokens**. A stolen token can be used from any device.

---

## 11. Authorization Architecture

Authorization is enforced on the backend via NestJS Guards and Decorators:
* `JwtAuthGuard`: Validates JWT signature and expiration.
* `RolesGuard` (`@Roles(...)`): Compares `user.role` from token payload against permitted `RoleName` enums (`ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`, `VIEWER`, `BENEFICIARY`).
* **Object-Level Authorization Defect**: In many administrative controllers, an authenticated officer can manipulate any record across all districts. There is no geographic partitioning (e.g., scoping a field officer to their assigned Panchayat).

---

## 12. Cache & State Architecture

### 12.1 Current State Classification
The application behaves as an **In-Memory Server-State Cache**:
* It is **NOT** a Local-First client: The frontend UI does not query a client-side SQLite or IndexedDB directly.
* It is **NOT** an offline cache: If the backend child process terminates, the frontend cannot display or mutate data.
* Every query uses `staleTime: 0` and `refetchOnMount: true` (`frontend/src/app/providers.tsx:13-14`). Data displayed on screen is always refetched from `http://127.0.0.1:4000/api/v1`.

### 12.2 Historic Cache Invalidation Defect Analysis
In earlier iterations, payments or bills showed zero until specific tabs were navigated. The audit reveals the root cause:
* Mutations in one component (e.g., recording a payment in `PaymentsManager`) must invalidate multiple overlapping query keys (`['payments']`, `['running-bills']`, `['beneficiary-dashboard']`, `['dashboard-stats']`).
* If a mutation omits an invalidation call, the other view continues displaying stale cached data until the browser window is reloaded.

---

## 13. Transaction Audit

Every critical business workflow was audited for atomic database guarantees:

| Workflow | Entry Point / Service | Database Operations | Transaction Boundary (`$transaction`) | Audit Logging Atomic? | Current Risk / Assessment |
|---|---|---|---|---|---|
| **Water Application Submission** | `WaterService.createApplication()` (`water.service.ts:204`) | Reads holding, checks existing active app, inserts `WaterApplication` | **YES** (`$transaction` in `water.service.ts:233`) | **NO** (`auditService.log` called at line 267 outside tx) | In-memory lock (`holdingLocks`) only protects single-process Node.js; no DB unique constraint on `land_id`. |
| **Water Allotment Approval** | `WaterService.approveApplication()` (`water.service.ts:480`) | Creates `WaterAllotment`, `DevelopmentBill`, 5 `Installment` records, `Infrastructure`, updates `WaterApplication` | **YES** (`$transaction` in `water.service.ts:574-666`) | **NO** (`auditService.log` called at line 669 outside tx) | Excellent business atomicity across 5 entities. If process crashes after tx commit, audit log is lost. |
| **Water Usage Recording** | `RunningBillingService.recordWaterUsage()` (`running-billing.service.ts:229`) | Validates meter reading / eligibility, creates/updates `WaterUsageRecord` | **NO** (Individual Prisma calls, no tx wrapper) | **NO** (Audit logged separately) | If immediate billing is requested (`generateBillImmediately`), bill creation occurs in a separate follow-up transaction. |
| **Running Bill Generation** | `RunningBillingService.generateBillFromUsage()` (`running-billing.service.ts:410`) | Inserts `RunningBill`, updates `WaterUsageRecord.status = BILLED` | **YES** (`$transaction` in `running-billing.service.ts:486-525`) | **NO** (`auditService.log` at line 528 outside tx) | Atomic bill creation. Guaranteed 1 bill per verified usage record. |
| **Payment Recording (Generic)** | `PaymentsService.recordPayment()` (`payments.service.ts:21`) | Inserts `Payment`, updates `Installment`, updates `DevelopmentBill` (or `RunningBill`) | **YES** (`$transaction` in `payments.service.ts:60-222`) | **NO** (`auditService.log` at line 224 outside tx) | Financial ledger write and balance reduction are strictly atomic. Audit is non-atomic. |
| **Payment Recording (Running Bill)** | `PaymentsService.recordRunningBillPayment()` (`payments.service.ts:247`) | Loads bill outside tx (line 275), calculates balance, inserts `Payment`, updates `RunningBill` | **PARTIAL** (`$transaction` in `payments.service.ts:337-373`) | **NO** (`auditService.log` at line 376 outside tx) | **CRITICAL RACE CONDITION**: Bill is read outside the transaction; concurrent calls can calculate stale balance and overwrite prior payment. |
| **Payment Reversal** | `PaymentsService.reversePayment()` (`payments.service.ts:399`) | Updates original payment to `REVERSED`, inserts negative `Payment`, restores bill & installment pending balances | **YES** (`$transaction` in `payments.service.ts:419-507`) | **NO** (`auditService.log` at line 509 outside tx) | Financial reversal and balance rollbacks are strictly atomic. |
| **Beneficiary Onboarding** | `BeneficiariesService.completeOnboarding()` (`beneficiaries.service.ts:182`) | Creates `Beneficiary`, creates multiple `LandHolding`s, `LandParcel`s (`createMany`), and `WaterApplication`s | **YES** (`$transaction` in `beneficiaries.service.ts:297-380`) | **NO** (`auditService.log` at line 383 outside tx) | Entity hierarchy created atomically. |
| **Land Modification** | `LandService.updateHoldingWithParcels()` (`land.service.ts:153`) | Updates `LandHolding`, deletes old `LandParcel`s, recreates new `LandParcel`s | **YES** (`$transaction` in `land.service.ts:230-265`) | **NO** (`auditService.log` outside tx) | Atomic parcel replacement. |
| **Infrastructure Milestone** | `InfrastructureService.updateStatus()` (`infrastructure.service.ts:83`) | Updates status and timestamps | **NO** (Single `update` call) | **NO** (Audit logged separately) | No state-machine validation guards. |
| **Location Import** | `LocationImportService.importLocationData()` (`location-import.service.ts:464`) | Upserts districts, blocks, villages; updates import record | **YES** (`$transaction` in `location-import.service.ts:550-630`) | **YES** (Audit written inside transaction) | Fully atomic batch location import. |
| **Clean State Wipe** | `DeveloperCleanStateService.executeCleanState()` (`developer-clean-state.service.ts:180`)| Deletes all domain tables in reverse dependency order | **YES** (`$transaction` in `developer-clean-state.service.ts:255-305`) | Logged to external JSONL file | Destructive hard-delete operation. |

---

## 14. Payment Architecture Audit

The payment subsystem was audited against distributed financial invariants:
1. **Idempotency Support**:
   - `PaymentsService.recordPayment()` (`payments.service.ts:47-58`) and `recordRunningBillPayment()` (`payments.service.ts:323-335`) check for `dto.idempotencyKey` against `payment_reference`.
   - If found, it returns the existing payment record without creating a second transaction.
   - *Limitation*: If no `idempotencyKey` is provided by the client, duplicate calls with identical amounts will issue duplicate receipts!
2. **Receipt Number Uniqueness**:
   - Receipt numbers are generated via `generateReceiptNumber()` (`payments.service.ts:791-796`): `${prefix}-${year}-${randomHex}`.
   - Guarded by database unique constraint `receipt_number @unique` on `Payment` table (`schema.sqlite.prisma:408`).
3. **Overpayment Protection**:
   - `if (payAmount.greaterThan(pendingAmount)) throw new BadRequestException(...)` (`payments.service.ts:84, 168, 312`).
   - Overpayments are strictly rejected.
4. **Immutability & Deletion Guard**:
   - Hard deletion is blocked by `PaymentsService.deletePayment()` (`payments.service.ts:787-789`), throwing `BadRequestException`.
   - Corrections must execute via `reversePayment()` (`payments.service.ts:399-521`), which creates an explicit negative audit record (`is_reversal: true`).

---

## 15. Running Charge Architecture Audit

The running charge model aligns with the modern operational domain:
1. **Actual Usage Driven**:
   $$\text{Amount Due} = \text{Actual Litres Snapshot} \times \text{Running Rate Snapshot}$$
   Approved allocation is **never** used as a billing multiplier (`running-billing.service.ts:462`).
2. **No Usage = No Bill Invariant**:
   `generateBillFromUsage(usageId)` strictly requires a verified `WaterUsageRecord` (`running-billing.service.ts:428-430`). A running bill cannot be created without usage.
3. **Usage Record Uniqueness**:
   Enforced at database level by `@@unique([allotment_id, billing_period_id])` in `WaterUsageRecord` (`schema.sqlite.prisma:510`). Exactly one usage record can exist per allotment per monthly period.
4. **Tariff Snapshot Rule**:
   `RunningBill` stores `running_cost_per_litre_snapshot` and `tariff_version` (`schema.sqlite.prisma:531, 535`). Future rate changes never rewrite existing bills.
5. **Legacy Bill Isolation**:
   Legacy V1 running bills are tagged with `is_legacy: true` and `legacy_classification` (`schema.sqlite.prisma:541-542`). They are excluded from actual-usage validation routines.

---

## 16. Development Billing & Installment Architecture

1. **Allotment Calculation**:
   $$\text{Calculated Litres} = \text{Declared Land Acres} \times \text{Litres Per Acre Snapshot}$$
2. **Development Bill Generation**:
   $$\text{Total Amount} = \text{Approved Litres} \times \text{Development Cost Per Litre Snapshot}$$
   Generated atomically inside `WaterService.approveApplication()` (`water.service.ts:592-603`).
3. **Installment Schedule**:
   Split into 5 installments based on `InstallmentTemplate` (default: 2.5%, 20%, 25%, 25%, 27.5%).
   Installment 5 absorbs penny rounding discrepancies (`water.service.ts:625-627`):
   $$\text{Inst 5 Amount} = \text{Total Development Cost} - \sum_{i=1}^{4} \text{Inst } i$$

---

## 17. Backup & Restore Architecture Audit

### 17.1 Backup Creation (`BackupService.createBackup`)
1. Flushes SQLite write-ahead log: `PRAGMA wal_checkpoint(FULL);` (`backup.service.ts:106`).
2. Gathers record count statistics across all models (`backup.service.ts:112-118`).
3. Reads `water_management.db` binary and computes SHA-256 checksum (`backup.service.ts:134`).
4. Bundles into a `.wmbak` archive format:
   `[4-byte Header Length (BE)] + [JSON Metadata Manifest] + [Raw SQLite Database Payload]`
5. Writes archive to `%APPDATA%/WaterManagement/backups/` (`backup.service.ts:167`).

### 17.2 Restore Execution (`BackupService.restoreBackup`)
1. Reads archive and parses JSON manifest (`backup.service.ts:249-265`).
2. Validates payload SHA-256 against `manifest.database.sha256` (`backup.service.ts:270-272`).
3. Backs up current database to `${dbPath}.pre-restore-${Date.now()}` (`backup.service.ts:276`).
4. Overwrites `water_management.db` via `fs.writeFileSync` (`backup.service.ts:285`).
5. Calls `prisma.reinitializeConnection()` (`backup.service.ts:288`).
6. Runs `PRAGMA integrity_check;` (`backup.service.ts:292`).

### 17.3 Multi-Device Incompatibility
* **Critical Finding**: The restore mechanism **cannot safely operate in a multi-device distributed system**. Restoring an old `.wmbak` file completely overwrites the local SQLite database. In a multi-agent environment, this would restore stale entity versions and re-introduce already processed payments.

---

## 18. File & Document Storage Architecture

* Files are referenced via the `BeneficiaryDocument` model (`schema.sqlite.prisma:623-639`).
* **Storage Reality**: The backend does **not** process binary file streaming or multi-part uploads. The client passes a local filesystem path string (`dto.storagePath` in `beneficiary-portal.service.ts:976`), which is stored as text in the database.
* Documents are stored unencrypted on the host filesystem without server-side checksum or integrity validation.

---

## 19. Concurrency & Locking Architecture

| Layer | Mechanism | Scope | Effectiveness |
|---|---|---|---|
| **Database Engine** | SQLite WAL Locking | Database File | SQLite allows multiple readers, but strictly **one writer** at a time. Concurrency is limited by `PRAGMA busy_timeout = 5000;`. |
| **Prisma ORM** | Interactive `$transaction` | Connection | Serializes operations within a single NestJS process. |
| **Application Layer** | In-Memory `Set<string>` Lock (`water.service.ts:188`) | Process Memory | `holdingLocks` prevents concurrent submissions for the same land holding *only within the same Node.js thread*. Ineffective across multiple processes or machines. |
| **Optimistic Concurrency** | None | Entity | Domain entities lack numeric `@version` columns. Stale-read overwrites are possible if two processes update the same record. |

---

## 20. Crash & Power Failure Analysis

| Failure Scenario | Timing of Crash | Current System Behavior | Data Integrity State | Recovery Mechanism |
|---|---|---|---|---|
| **Payment Crash A** | Crash before `$transaction` begins | Nothing written to disk. | Clean: No partial records. | User retries payment. |
| **Payment Crash B** | Crash during `$transaction` write | SQLite WAL rolls back transaction on restart. | Clean: Atomic rollback. | Next launch recovers consistent state. |
| **Payment Crash C** | Crash after DB commit, before HTTP response | Payment and updated balances are committed in DB. Client sees timeout/failure. | **Desynchronized**: DB has payment, user thinks it failed. | **High Risk**: If user retries without idempotency key, a duplicate payment is charged! |
| **Payment Crash D** | Crash during audit logging | Payment committed, but audit log is not written (`auditService.log` called outside tx). | Incomplete Audit: Transaction exists without audit entry. | Unrecoverable audit gap. |
| **Restore Crash** | Crash halfway through `fs.writeFileSync(dbPath)` | Database file corrupted. | Corrupted SQLite file. | Safety backup exists at `.pre-restore-<timestamp>`. |

---

## 21. Clock & Time Analysis

The system includes an `ApplicationClockService` (`backend/src/modules/system/application-clock.service.ts`):
1. **Clock Rollback Detection**: Compares current time against `last_known_timestamp` in `SystemClockState` table (`schema.sqlite.prisma:562`).
2. If current time is $>60\text{ seconds}$ earlier than last known time:
   - Sets `is_rollback_detected = true`.
   - Logs `AuditAction.SYSTEM_CLOCK_ROLLBACK`.
   - `assertClockValid()` blocks water usage recording and running bill generation (`application-clock.service.ts:144-151`).
3. **Defect**: `assertClockValid()` is **not** called during payment recording or water application creation! Users can record backdated payments on a tampered clock.

---

## 22. Audit Trail Architecture

* Model: `AuditLog` (`schema.sqlite.prisma:601-621`).
* Captures: `audit_id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_values` (JSON string), `new_values` (JSON string), `reason`, `ip_address`, `created_at`.
* **Append-Only Integrity**: There are no update or delete endpoints exposed for `AuditLog`.
* **Transaction Gap**: In 90% of service methods, audit logs are executed outside the database transaction, meaning an audit write failure does not roll back the domain entity change.

---

## 23. Error & Retry Model

* **HTTP Exception Handling**: `AllExceptionsFilter` (`backend/src/modules/common/filters/http-exception.filter.ts`) converts errors into structured JSON:
  `{ statusCode, timestamp, path, method, message, error }`.
* **Client Retry Behavior**: The frontend Axios client does not perform automated retries on network failures; it immediately surfaces toast notifications to the user.
* **Failure Classification Gap**: The system currently does not distinguish between `TRANSIENT_NETWORK_ERROR`, `BUSINESS_VALIDATION_ERROR`, and `DATA_CONFLICT`.

---

## 24. Current Offline Capability Matrix

Classification of domain operations in current V1:

| Operation | Offline Capability | Current Implementation Status | V2 Architectural Requirement |
|---|---|---|---|
| User Login | Offline | Works via local bcrypt against local SQLite | Requires local cached credentials + periodic online refresh |
| Beneficiary Registration | Offline | Fully functional locally | Requires client outbox + server duplicate phone detection |
| Land Holding & Parcel Creation | Offline | Fully functional locally | Requires outbox + server parcel uniqueness validation |
| Water Application Submission | Offline | Fully functional locally | Requires outbox + dependency ordering |
| Water Allotment Approval | Offline | Functional, but administrative | **Must be Online-Only / Server Authoritative** |
| Water Usage Recording | Offline | Fully functional locally | **Core Offline Capability (Outbox + Sync)** |
| Running Bill Generation | Offline | Local generation | **Must be Server Authoritative** |
| Payment Collection | Offline | Local generation | **Controlled Offline Capture (Outbox + Idempotency)** |
| Payment Reversal | Offline | Functional locally | **Must be Online-Only (Audit & Authority)** |
| Tariff Management | Offline | Functional locally | **Must be Online-Only / Master Data** |
| Infrastructure Commissioning | Offline | Functional locally | **Must be Online-Only / Eligibility Gate** |
| System Backup (.wmbak) | Offline | Fully functional locally | Retain for local disaster recovery |
| System Restore | Offline | Fully functional locally | **Must be restricted in multi-device sync environment** |
| Developer Clean State | Offline | Functional locally | **Must be strictly gated / disabled in production** |

---

## 25. Reusable Components for V2

| Component | Repository Path | Recommendation | Technical Rationale |
|---|---|---|---|
| **Decimal Arithmetic Engine** | `backend/src/modules/common/decimal.util.ts` | **KEEP** | Robust, precision-safe decimal operations using `decimal.js`. Completely avoids JS float bugs. |
| **Running Charges Formula** | `backend/src/modules/billing/running-billing.service.ts` | **KEEP** | Authoritative formula ($\text{Actual Usage} \times \text{Tariff} = \text{Due}$) is fully implemented and tested. |
| **Water Allocation Formulas** | `backend/src/modules/water/water.service.ts` | **KEEP** | Valid land area and quota multiplier formulas with milestone installment schedules. |
| **Receipt PDF Generator** | `backend/src/modules/payments/payments.service.ts:611-781` | **KEEP WITH MODS** | PDFKit layout is complete. Needs visual watermark for offline pending receipts. |
| **Clock Rollback Detector**| `backend/src/modules/system/application-clock.service.ts` | **KEEP WITH MODS** | Excellent tamper detection logic; needs integration into payment paths. |
| **Electron Process Shell** | `electron/main.js` | **REUSE WITH MODS** | Robust process spawner; needs migration toward embedded Sync Worker instead of child NestJS. |
| **PostgreSQL Prisma Schema**| `backend/prisma/schema.prisma` | **REUSE WITH MODS** | Full relational schema; needs sync tables (`sync_operations`, `sync_outbox`). |

---

## 26. Components Requiring Replacement or Redesign

1. **Local Storage Authentication** (`frontend/src/lib/api.ts` & `auth-context.tsx`):
   - *Issue*: Tokens stored in browser `localStorage`.
   - *Target*: Migrate to OS-protected secure storage (Electron `safeStorage` via IPC).
2. **Ad-Hoc Idempotency** (`payments.service.ts:47`):
   - *Issue*: Idempotency only checks `payment_reference` on payments.
   - *Target*: General-purpose `SyncInbox` and `SyncOutbox` using UUIDv7 operation IDs and payload hashes.
3. **Database Restore Mechanism** (`backup.service.ts:239`):
   - *Issue*: Blindly overwrites SQLite database file.
   - *Target*: Controlled sync reconciliation that merges server state while preserving local outbox.
4. **Non-Atomic Audit Logging** (`audit.service.ts` callers):
   - *Issue*: Audit writes execute outside database transactions.
   - *Target*: Mandate `tx` parameter in all critical domain transactions.
5. **In-Memory Concurrency Locks** (`water.service.ts:188`):
   - *Issue*: `holdingLocks = new Set<string>()` fails across processes.
   - *Target*: Database constraints + server-side transactional synchronization locks.

---

## 27. Architectural Debt & Critical Findings

1. **Critical Defect: Concurrent Payment Balance Race Condition** (`payments.service.ts:275-345`):
   In `recordRunningBillPayment()`, `runningBill` is fetched *before* entering `$transaction`. Two concurrent calls read the same initial balance, leading to the second write overwriting the first payment's balance reduction.
2. **Missing SQLite Foreign Key Enforcement**:
   `PRAGMA foreign_keys = ON;` is never executed in `prisma.service.ts`, meaning raw queries bypass constraint checks.
3. **Absence of Monotonic Entity Versioning**:
   No domain entity has a numeric `version` column. Concurrent edits cannot detect stale updates.
4. **Unconstrained Water Applications**:
   There is no unique database index on `water_applications(land_id)`; uniqueness is checked solely by application-level queries.
5. **No Network Outbox**:
   Local operations write directly to business tables. There is no queue tracking unsynchronized events.

---

## 28. Evidence Index

| Architectural Claim | Source File | Exact Line Range | Evidence Description |
|---|---|---|---|
| Single Instance Lock | `electron/main.js` | Lines 48–59 | Calls `app.requestSingleInstanceLock()`; quits if duplicate. |
| AppData Path Calculation | `electron/main.js` | Lines 17–34 | Creates `WaterManagement` subfolders in `LOCALAPPDATA` / `APPDATA`. |
| Fresh DB Initialization | `electron/main.js` | Lines 277–292 | Copies `backend/prisma/template.db` if `water_management.db` is missing. |
| Background Process Fork | `electron/main.js` | Lines 163–250 | Uses `utilityProcess.fork` or `child_process.fork` with `ELECTRON_RUN_AS_NODE: '1'`. |
| Abrupt Process Kill | `electron/main.js` | Lines 634–650 | `before-quit` calls `backendProcess.kill()` without Prisma disconnect hooks. |
| ContextBridge Exposure | `electron/preload.js` | Lines 1–8 | Exposes `getAppInfo`, `openStorageFolder`, `isDesktop: true`. |
| Backend Port Binding | `backend/src/main.ts` | Lines 44–46 | Binds strictly to `127.0.0.1:4000`. |
| SQLite Engine PRAGMAs | `backend/src/modules/prisma/prisma.service.ts` | Lines 58–67 | Configures WAL, cache=64MB, temp_store=MEMORY, busy_timeout=5000. |
| Missing FK PRAGMA | `backend/src/modules/prisma/prisma.service.ts` | Lines 58–67 | `PRAGMA foreign_keys = ON;` is completely absent. |
| In-Memory QueryClient | `frontend/src/app/providers.tsx` | Lines 8–18 | `QueryClient` configured with `staleTime: 0`, in-memory only. |
| LocalStorage Token Store | `frontend/src/lib/api.ts` | Lines 12–20, 33 | Access and refresh tokens read/written directly to `localStorage`. |
| Payment Idempotency Check | `backend/src/modules/payments/payments.service.ts` | Lines 47–58 | Checks `payment_reference = dto.idempotencyKey`. |
| Payment Race Condition | `backend/src/modules/payments/payments.service.ts` | Lines 275–345 | `runningBill` loaded outside `$transaction`; balance computed on stale read. |
| Immutable Payment Guard | `backend/src/modules/payments/payments.service.ts` | Lines 787–789 | `deletePayment()` explicitly throws `BadRequestException`. |
| Running Charge Invariant | `backend/src/modules/billing/running-billing.service.ts` | Lines 460–463 | Formula: `actualUsageLitres * ratePerLitre = amountDue`. |
| No Usage = No Bill | `backend/src/modules/billing/running-billing.service.ts` | Lines 428–430 | Rejects bill generation if `usage_id` is missing or unverified. |
| Allotment Approval Tx | `backend/src/modules/water/water.service.ts` | Lines 574–666 | Atomic `$transaction` creating Allotment, Bill, 5 Installments, Infrastructure. |
| Non-Atomic Audit Write | `backend/src/modules/water/water.service.ts` | Lines 669–685 | `auditService.log` called after `$transaction` commits. |
| Clock Rollback Guard | `backend/src/modules/system/application-clock.service.ts` | Lines 73–139 | Flags rollback if time jumps backward $>60\text{ seconds}$. |
| Clock Check Omission | `backend/src/modules/payments/payments.service.ts` | Lines 21–235 | Payments recorded without calling `assertClockValid()`. |
| Database Restore Overwrite| `backend/src/modules/backup/backup.service.ts` | Lines 275–288 | Direct `fs.writeFileSync(dbPath)` replaces database file. |
| In-Memory Concurrency Lock| `backend/src/modules/water/water.service.ts` | Lines 188–198 | Uses single-process `Set<string>` lock for land holdings. |

---

## 29. Final Architecture Scorecard

| Architectural Dimension | Current Readiness | Detailed Architectural Justification |
|---|---|---|
| **Offline Persistence** | **READY** | SQLite with WAL mode running locally in AppData provides robust persistence across restarts. |
| **Financial Arithmetic** | **READY** | All monetary calculations use `decimal.js` with explicit penny rounding; zero floating-point leakage. |
| **Running Charge Model** | **READY** | Follows the verified actual usage model ($\text{Actual Usage} \times \text{Tariff} = \text{Due}$). Historical bills are immutable. |
| **Financial Atomicity** | **READY WITH CHANGES** | Core operations use `$transaction`, but audit writes are non-atomic and payment balance race conditions exist. |
| **Authentication & Tokens**| **READY WITH CHANGES** | Bcrypt and JWT rotation work, but tokens are stored insecurely in `localStorage` with hardcoded fallbacks. |
| **Audit Trail** | **READY WITH CHANGES** | Append-only audit structure is sound, but must be written inside domain transactions to avoid loss on crash. |
| **Clock Tamper Protection**| **READY WITH CHANGES** | Rollback detector works for billing, but must be added to payment and application submission endpoints. |
| **Idempotency** | **REQUIRES REDESIGN** | Currently an ad-hoc check on payments; requires universal UUIDv7 operation envelope and request hash storage. |
| **Concurrency & Locks** | **REQUIRES REDESIGN** | Relies on in-memory Node.js `Set` locks and lacks database-level foreign key enforcement and entity versioning. |
| **Backup & Restore** | **REQUIRES REDESIGN** | Restore blindly overwrites the database file, which would destroy unsynchronized work in a multi-device system. |
| **Multi-Device Sync** | **REQUIRES REDESIGN** | Zero existing synchronization infrastructure: no outbox, no change feed, no conflict detection, no device ID. |
| **Client Process Model** | **REQUIRES REDESIGN** | Running a duplicate local NestJS child process inside every client laptop is redundant when connecting to a remote server. |

---

## 30. Conclusion & Next Steps

WaterGrid V1 possesses a **solid, mathematically sound financial and domain core**, but its execution environment is strictly bound to a **single-node offline desktop assumption**. 

Before implementing V2 synchronization, the system requires:
1. **Schema Enhancements**: Adding `version Int @default(1)` across all mutable models and establishing database-level uniqueness constraints.
2. **Sync Outbox & Inbox Protocol**: Implementing persistent outbox tables with UUIDv7 operation identifiers and payload hashing.
3. **Client Architecture Modernization**: Transitioning Electron to interact directly with local SQLite via typed IPC and a lightweight Sync Worker, communicating with a central authoritative NestJS + PostgreSQL server.
4. **Secure Credential Storage**: Eliminating `localStorage` token persistence in favor of OS-backed credential storage.
