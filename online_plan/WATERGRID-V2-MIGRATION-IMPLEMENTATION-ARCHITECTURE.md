# WATERGRID V2 — MIGRATION & IMPLEMENTATION ARCHITECTURE

**Document ID:** `WATERGRID-V2-MIGRATION-IMPLEMENTATION-ARCHITECTURE`  
**Version:** `1.0.0`  
**Classification:** Architecture / Migration / Implementation Planning  
**Status:** Pre-Implementation Baseline  
**Purpose:** Define the safe path from WaterGrid V1 single-node offline desktop architecture to a production-grade online + offline multi-agent architecture.

---

# 1. Executive Summary

WaterGrid V1 is a single-node desktop application:

```text
Electron
  ↓
Next.js
  ↓
Local NestJS
  ↓
Prisma
  ↓
SQLite
```

It is offline-capable because the complete application stack runs locally.

WaterGrid V2 is a distributed system:

```text
                    ┌─────────────────────┐
                    │ CENTRAL SERVER      │
                    │ NestJS              │
                    │ PostgreSQL          │
                    │ Auth / RBAC         │
                    │ Sync / API          │
                    └──────────┬──────────┘
                               │
                         Internet
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
      ┌──────▼──────┐                     ┌──────▼──────┐
      │ DEVICE A    │                     │ DEVICE B    │
      │ Electron    │                     │ Electron    │
      │ Local DB    │                     │ Local DB    │
      │ Outbox      │                     │ Outbox      │
      │ Sync Worker │                     │ Sync Worker │
      └─────────────┘                     └─────────────┘
```

The migration MUST NOT be a big-bang rewrite.

The recommended strategy is:

```text
V1 HARDENING
     ↓
DATA MODEL PREPARATION
     ↓
SERVER FOUNDATION
     ↓
ONLINE MODE
     ↓
OFFLINE OUTBOX
     ↓
SYNC ENGINE
     ↓
CONFLICT / RECOVERY HARDENING
     ↓
PRODUCTION CUTOVER
```

The central architectural principle is:

> Temporary offline divergence is acceptable. Permanent contradictory financial truth is not.

The server becomes authoritative for shared financial and authorization state.

The device becomes authoritative only for its own local pending operations until those operations are accepted, rejected, or conflicted by the server.

---

# 2. Source Architecture Documents

This plan is derived from:

1. `WATERGRID-V2-DOMAIN-CONTRACT`
2. `WATERGRID-V2-OFFLINE-ONLINE-CONTRACT`
3. `WATERGRID-V2-SYNC-CONTRACT`
4. `WATERGRID-V2-SECURITY-CONTRACT`
5. `WATERGRID-V2-OFFLINE-CURRENT-STATE-ARCHITECTURE`

The first four describe the intended target behavior.

The fifth describes the actual current implementation.

The repository remains the source of truth for implementation details.

---

# 3. Migration Principles

## 3.1 No Big-Bang Rewrite

Do not simultaneously rewrite:

- database
- authentication
- Electron
- frontend
- backend
- billing
- payments
- synchronization

Each major architectural change requires an independently testable stage.

## 3.2 Existing Financial Data Is Sacred

Existing:

- payments
- bills
- installments
- allotments
- usage
- tariffs
- audit history

must never be silently recalculated or rewritten.

Migration may add metadata but must preserve historical financial meaning.

## 3.3 IDs Remain Stable

Existing UUID primary keys should be preserved wherever possible.

Do not regenerate beneficiary, land, allotment, bill, payment, usage, or audit IDs merely because the database engine changes.

## 3.4 Server Authority

After V2 synchronization is active:

```text
Financial truth
Authorization truth
Role truth
Tariff truth
Approval truth
Device truth
Conflict truth
```

are server-authoritative.

## 3.5 Local Pending State

Offline operations are not fake server records.

They are real local operations with explicit lifecycle:

```text
CREATED LOCALLY
    ↓
PENDING SYNC
    ↓
SENT
    ↓
ACKNOWLEDGED
```

or:

```text
PENDING
   ↓
CONFLICT
```

or:

```text
PENDING
   ↓
REJECTED
```

## 3.6 No Last-Write-Wins for Financial Data

Financial records must never be silently overwritten based only on timestamp.

---

# 4. Target Architecture

## 4.1 Server

Recommended production topology:

```text
Internet
   ↓
TLS
   ↓
Reverse Proxy / Load Balancer
   ↓
NestJS API
   ├── Auth
   ├── RBAC
   ├── Domain Services
   ├── Sync Service
   ├── Audit
   └── Reporting
          ↓
      PostgreSQL
```

Optional later components:

```text
Redis
Background Workers
Object Storage
Monitoring
```

Do not introduce Redis merely because the system is online. Add infrastructure only when a demonstrated requirement exists.

## 4.2 Desktop

The desktop application becomes:

```text
Electron
   │
   ├── Next.js UI
   │
   ├── Local Domain/API Runtime
   │
   ├── Local SQLite
   │
   └── Sync Worker
```

The existing local NestJS runtime may initially remain.

Do not replace it merely for architectural elegance.

The first objective is correctness.

---

# 5. Target Authority Model

| Data | Device | Server |
|---|---|---|
| Cached master data | Read cache | Authoritative |
| Beneficiary pending creation | Local pending | Authoritative after acceptance |
| Land pending changes | Local pending | Authoritative after acceptance |
| Water usage captured offline | Local pending | Authoritative after acceptance |
| Running bill | Derived/pending display | Authoritative |
| Development bill | Cached | Authoritative |
| Payment captured offline | Pending financial operation | Authoritative after acceptance |
| Payment reversal | Not authoritative offline | Online/server only |
| Tariff | Cached | Authoritative |
| Approval | Read-only offline | Server only |
| User role | Cached snapshot | Server only |
| Device status | Local status | Server only |
| Audit | Local pending copy | Server authoritative after sync |

---

# 6. Phase 0 — Freeze the V1 Baseline

Before modifying architecture:

1. Tag the current stable V1 release.
2. Preserve the current SQLite schema.
3. Preserve a clean production database backup.
4. Record Prisma version.
5. Record Node version.
6. Record Electron version.
7. Record Next.js version.
8. Record NestJS version.
9. Record package lockfiles.
10. Record build artifacts.
11. Record database migrations.
12. Record current test suite.
13. Record current financial invariants.
14. Record current known defects.

Create:

```text
V1-STABLE
V1-DATA-SNAPSHOT
V1-BUILD-SNAPSHOT
V1-QA-BASELINE
```

No V2 migration begins until this baseline is reproducible.

---

# 7. Phase 1 — V1 Hardening

Do this BEFORE distributed synchronization.

## 7.1 Fix Running Payment Race

Current defect:

```text
load RunningBill
calculate pending
BEGIN transaction
write payment
```

Required:

```text
BEGIN TRANSACTION
    load authoritative bill state
    validate current balance
    validate payment
    create payment
    update financial state
    create audit
COMMIT
```

The authoritative balance must be calculated inside the transaction.

Do not solve this with frontend locking.

## 7.2 Atomic Audit

Critical business transactions should include audit creation inside the same transaction.

Preferred service structure:

```typescript
await prisma.$transaction(async tx => {
    // domain mutation
    // financial mutation
    // audit mutation
});
```

Audit must not become a reason to silently lose the business operation, nor should a successful business operation silently lose its audit record.

## 7.3 Database Constraints

Identify every business invariant currently enforced only in application code.

Convert suitable invariants to database constraints.

Examples:

```text
WaterUsage:
(allotment_id, billing_period_id) UNIQUE

Installment:
(bill_id, installment_number) UNIQUE

Payment:
(receipt_number) UNIQUE
```

For water applications, first determine the exact lifecycle requirement before adding a uniqueness constraint.

Do not blindly enforce:

```text
land_id UNIQUE
```

if historical/voided applications are allowed.

Use a schema design that matches the actual lifecycle.

## 7.4 SQLite Foreign Keys

Verify actual Prisma/SQLite behavior first.

If foreign keys are required at runtime, explicitly configure and test:

```sql
PRAGMA foreign_keys = ON;
```

Do not assume it is enabled merely because Prisma relations exist.

## 7.5 Clock Validation

Apply the clock policy consistently to sensitive operations.

Especially inspect:

- payments
- water applications
- usage
- billing
- reversals
- approvals

Do not allow local clock manipulation to create invalid financial chronology.

## 7.6 Idempotency Foundation

Before online sync, introduce a general operation identity concept.

A local operation must have:

```text
operationId
idempotencyKey
createdAt
actor
deviceId
operationType
aggregateType
aggregateId
payloadHash
```

Payments should no longer be the only place with idempotency.

---

# 8. Phase 2 — Domain/Data Model Preparation

The goal is to prepare the existing schema without activating synchronization.

## 8.1 Version Mutable Aggregates

Introduce an optimistic version/revision mechanism where appropriate.

Example:

```text
version INTEGER NOT NULL DEFAULT 1
```

Candidate aggregates:

- Beneficiary
- LandHolding
- WaterApplication
- WaterAllotment
- Infrastructure
- Extension
- BillingPeriod
- WaterUsageRecord
- RunningBill
- DevelopmentBill
- Installment

Do NOT blindly add version fields to immutable ledger rows.

Payments and audit records should generally behave as append-only records.

## 8.2 Stable IDs

Confirm all synchronized entities have stable UUID identifiers.

Avoid server-generated IDs that cannot exist offline.

The device must be able to generate IDs safely offline.

## 8.3 Created/Updated Metadata

Where relevant:

```text
created_at
updated_at
created_by
updated_by
```

must be explicit.

For synchronized records, distinguish:

```text
business timestamp
device timestamp
server timestamp
```

where required.

## 8.4 Operation Metadata

Introduce the concept of:

```text
Device
Operation
Idempotency
Revision
Server Change Sequence
```

without necessarily activating full synchronization yet.

---

# 9. Phase 3 — Server Database

Move shared authoritative data to PostgreSQL.

## 9.1 Migration Strategy

Do NOT:

```text
SQLite → dump → PostgreSQL → production
```

without validation.

Instead:

```text
SQLite snapshot
    ↓
staging migration
    ↓
schema validation
    ↓
row-count validation
    ↓
relationship validation
    ↓
financial reconciliation
    ↓
application verification
    ↓
pilot
    ↓
production
```

## 9.2 Migration Ordering

Recommended dependency order:

```text
Roles
Users
Projects
Locations
Rate Configurations
Installment Templates
Beneficiaries
Land Holdings
Land Parcels
Water Applications
Water Allotments
Development Bills
Installments
Infrastructure
Billing Periods
Water Usage
Running Bills
Payments
Extensions
Documents
Audit Logs
```

Exact order must follow actual foreign-key dependencies.

## 9.3 Financial Reconciliation

After migration:

```text
DevelopmentBill.total
=
SUM(Installments.amount_due)

DevelopmentBill.paid
=
SUM(valid payments)

DevelopmentBill.pending
=
total - paid

RunningBill.amount_due
=
usage × rate_snapshot

RunningBill.paid
=
SUM(valid running-bill payments)

RunningBill.pending
=
amount_due - paid
```

Every mismatch must block migration approval.

---

# 10. Phase 4 — Central Server Foundation

Implement the central server before enabling offline sync.

Components:

```text
Auth
Users
Roles
Devices
API
PostgreSQL
Audit
Health
Sync Infrastructure
```

## 10.1 Server Must Be Independently Operable

The server must function without any Electron client.

Provide:

```text
/api/v1/auth
/api/v1/beneficiaries
/api/v1/land
/api/v1/water
/api/v1/billing
/api/v1/payments
/api/v1/sync
/api/v1/devices
```

Actual route structure may follow existing conventions.

## 10.2 PostgreSQL Is Authoritative

Clients never connect directly to PostgreSQL.

```text
Electron → HTTPS → API → PostgreSQL
```

---

# 11. Phase 5 — Authentication Migration

Current V1:

```text
JWT
+
localStorage
+
local SQLite refresh token
```

V2 target:

```text
User
+
Device
+
Session
+
Access credential
+
Refresh credential
```

## 11.1 Device Registration

Each installation gets a stable device identifier.

Example:

```text
deviceId
deviceName
platform
appVersion
status
lastSeenAt
registeredAt
```

Device states:

```text
ACTIVE
REVOKED
BLOCKED
```

## 11.2 Secure Credential Storage

Electron credentials should move out of:

```text
localStorage
```

into OS-backed secure storage.

Use Electron's secure-storage capabilities or an equivalent OS-backed mechanism.

The exact implementation must be validated on:

- Windows
- macOS

## 11.3 Offline Authentication

Offline login must use a bounded local authorization model.

The device may validate:

```text
cached identity
cached permission snapshot
offline credential policy
device status snapshot
```

But sensitive server-only actions remain unavailable offline.

---

# 12. Phase 6 — Online Mode

Before implementing offline sync, make the application work reliably online.

Online flow:

```text
Electron
   ↓ HTTPS
Central API
   ↓
PostgreSQL
```

The device may retain a local cache, but the server is authoritative.

Implement and test:

- login
- logout
- refresh
- beneficiaries
- land
- water
- billing
- payments
- reporting
- audit
- RBAC
- device registration

Do not implement offline writes yet.

This isolates online bugs from synchronization bugs.

---

# 13. Phase 7 — Local Offline Database

The existing SQLite database becomes a local operational store/cache.

It is NOT a second independent financial authority.

Local schema should eventually include synchronization metadata.

Core concepts:

```text
sync_outbox
sync_inbox / operation history
sync_cursor
device
local_session
conflict
```

Potential local operation states:

```text
PENDING
READY
IN_FLIGHT
ACKNOWLEDGED
RETRY_WAIT
CONFLICT
REJECTED
DEPENDENCY_BLOCKED
CANCELLED
```

---

# 14. Phase 8 — Outbox

This is the key transition from local-only to offline-first.

Every offline-capable write must perform:

```text
BEGIN LOCAL TRANSACTION

1. Validate operation
2. Write local business record
3. Create outbox operation

COMMIT
```

Never:

```text
write business record
↓
later create outbox
```

because a crash between those operations loses the synchronization intent.

## 14.1 Outbox Envelope

Minimum:

```text
operationId
deviceId
actorUserId
operationType
aggregateType
aggregateId
expectedVersion
clientCreatedAt
sequenceNumber
idempotencyKey
payload
payloadHash
status
retryCount
lastError
createdAt
updatedAt
```

## 14.2 Operation IDs

Generate IDs locally.

They must be globally unique.

UUIDv7 or equivalent time-sortable UUID is recommended.

---

# 15. Phase 9 — Synchronization Engine

Synchronization is operation-based.

Not:

```text
replace database with server database
```

Not:

```text
copy rows
```

Not:

```text
last-write-wins
```

Instead:

```text
LOCAL OPERATION
      ↓
OUTBOX
      ↓
SYNC WORKER
      ↓
HTTPS
      ↓
SERVER IDEMPOTENCY CHECK
      ↓
SERVER TRANSACTION
      ↓
ACK / REJECT / CONFLICT
      ↓
LOCAL STATE UPDATE
```

---

# 16. Sync Push

Push operations in dependency order.

Example:

```text
Create Beneficiary
        ↓
Create Land Holding
        ↓
Create Water Application
        ↓
Approval
        ↓
Usage
        ↓
Bill
        ↓
Payment
```

Server must reject operations whose prerequisites are missing.

The client should not randomly reorder dependent operations.

---

# 17. Sync Pull

Server maintains a durable change sequence:

```text
serverChangeSequence
```

Client stores:

```text
lastPulledSequence
```

Flow:

```text
GET changes after sequence N
        ↓
validate
        ↓
apply local changes transactionally
        ↓
advance cursor
```

Cursor advancement occurs only after the local transaction succeeds.

---

# 18. Idempotent Server Processing

Server must treat every operation as potentially duplicated.

Flow:

```text
receive operationId
       ↓
check sync operation inbox
       ↓
already processed?
   YES → return stored result
   NO
       ↓
validate
       ↓
execute domain transaction
       ↓
store result
       ↓
commit
       ↓
return result
```

Therefore:

```text
at-least-once delivery
+
idempotent processing
=
exactly-once business effect
```

without requiring exactly-once networking.

---

# 19. Conflict Architecture

Conflicts are not generic merge problems.

## 19.1 Financial Conflict

Example:

```text
Bill = ₹10,000

Agent A offline:
Payment ₹7,000

Agent B online:
Payment ₹6,000
```

Server accepts B:

```text
Pending = ₹4,000
```

A later syncs.

Server must reject or classify A's payment because the authoritative balance is no longer sufficient.

It must NOT:

```text
accept ₹7,000
```

and create:

```text
₹13,000 paid against ₹10,000
```

It must NOT silently partially apply ₹4,000.

## 19.2 Conflict Result

Return:

```text
CONFLICT_PAYMENT_BALANCE_CHANGED
```

with:

- operation ID
- bill ID
- client amount
- server pending amount
- server version
- server state
- resolution requirement

The UI should explain the conflict to the authorized user.

---

# 20. Running Charges Migration

The running charge model remains:

```text
Commissioned Infrastructure
        ↓
Billing Period
        ↓
Field Collection Visit
        ↓
Actual Usage
        ↓
Verification
        ↓
Tariff Resolution
        ↓
Running Bill
        ↓
Payment
```

## 20.1 Offline Agent

Agent can:

```text
select beneficiary/allotment
record actual usage
record meter readings
capture notes
capture controlled payment
```

## 20.2 Server

Server decides:

```text
eligibility
billing period
tariff
bill
authoritative balance
payment acceptance
```

## 20.3 Offline Bill Display

The device may show a locally calculated estimate where permitted, but must clearly distinguish:

```text
LOCAL ESTIMATE
```

from:

```text
SERVER CONFIRMED BILL
```

Do not let a local calculation become authoritative merely because it looks correct.

---

# 21. Payment Migration

Payments receive the strongest protection.

## Online payment:

```text
Payment request
 ↓
Authentication
 ↓
Authorization
 ↓
Idempotency
 ↓
Load bill inside transaction
 ↓
Calculate current pending
 ↓
Validate amount
 ↓
Insert payment
 ↓
Update derived/summary state
 ↓
Audit
 ↓
Commit
```

## Offline payment:

```text
Capture payment locally
 ↓
PENDING_SYNC
 ↓
Offline receipt
 ↓
Sync
 ↓
Server validation
 ↓
CONFIRMED
```

Offline receipt must clearly indicate:

```text
OFFLINE — PENDING SERVER CONFIRMATION
```

It must never falsely state that the central system has confirmed the payment.

---

# 22. Payment Reversal

Payment reversal is high-risk.

Recommended V2 policy:

```text
ONLINE ONLY
```

because reversal requires current server financial state.

The device may display the existing payment offline, but cannot authoritatively reverse it offline.

---

# 23. Development Billing

Development billing remains server-authoritative.

The existing formula remains:

```text
Development Cost
=
Approved Litres
×
Applicable Development Cost/Litre
```

Installments remain:

```text
2.5%
20%
25%
25%
27.5%
```

Historical rate snapshots remain immutable.

Offline clients may display cached bills and balances.

New approvals and financial restructuring should remain server-authoritative.

---

# 24. Tariff Architecture

Tariffs are server-owned master data.

Offline devices receive versioned tariff snapshots.

Example:

```text
Tariff Version 12
effective_from = 2026-10-01
running_rate = ₹X/L
```

A tariff change never rewrites historical bills.

Offline devices must not invent new tariff versions.

---

# 25. Billing Period Architecture

Use fixed calendar periods:

```text
YYYY-MM
```

The server determines the authoritative period.

No financial cron job is required to "create reality."

A billing period can be deterministically derived.

Offline devices may calculate the period for data capture, but server validation remains authoritative.

---

# 26. Backup / Restore Redesign

Current V1:

```text
restore backup
↓
replace SQLite database
```

This is unsafe after synchronization begins.

V2 restore must preserve:

```text
pending outbox
device identity
operation IDs
sync cursor
conflicts
```

Never blindly replace the operational database while pending operations exist.

Recommended restore workflow:

```text
Validate backup
 ↓
Stop sync
 ↓
Export/preserve local pending operations
 ↓
Restore compatible local state
 ↓
Reconcile with server
 ↓
Restore pending operations
 ↓
Run integrity checks
 ↓
Resume sync
```

A full server snapshot restore is a separate disaster-recovery procedure and must not be confused with client restore.

---

# 27. Audit Migration

Audit becomes a distributed event stream.

Every accepted server-side financial operation must generate an authoritative audit record.

Client-side pending audit entries may exist but are not authoritative until accepted.

Recommended fields:

```text
auditId
operationId
serverSequence
actorUserId
deviceId
action
entityType
entityId
before
after
reason
serverTimestamp
```

Do not trust client timestamps as the authoritative audit timestamp.

---

# 28. Reporting Migration

Reports must identify their authority.

Online:

```text
SERVER DATASET
```

Offline:

```text
LOCAL CACHE + PENDING OVERLAY
```

Offline reports must not silently appear identical to complete server reports.

For example:

```text
Data as of server sync:
10:30 AM

Pending local operations:
3
```

This distinction prevents users from interpreting incomplete offline data as globally complete.

---

# 29. Electron Migration

Do not immediately remove the local NestJS process.

Phase 1:

```text
Electron
 ├── Next.js
 ├── Local NestJS
 └── SQLite
```

Phase 2:

```text
Electron
 ├── Next.js
 ├── Local API/domain runtime
 ├── SQLite
 └── Sync Worker
```

Whether the NestJS child process is retained permanently should be decided after measuring:

- startup
- memory
- crash recovery
- IPC complexity
- packaging
- security
- maintainability

Do not optimize architecture prematurely.

---

# 30. Network State Machine

The UI must not use a simplistic:

```text
internet = online
```

Use:

```text
ONLINE
OFFLINE
SYNCING
DEGRADED
ATTENTION
```

Example:

```text
No internet
    ↓
OFFLINE

Internet restored
    ↓
API health check
    ↓
authenticated?
    ↓
SYNCING
    ↓
all pending processed?
    ↓
ONLINE
```

If authentication fails:

```text
ATTENTION
```

not simply:

```text
OFFLINE
```

---

# 31. Operation State Machine

```text
CREATED
   ↓
READY
   ↓
IN_FLIGHT
   ├── ACKNOWLEDGED
   ├── RETRY_WAIT
   ├── CONFLICT
   └── REJECTED
```

Technical failures:

```text
RETRY
```

Business failures:

```text
REJECT / CONFLICT
```

Do not endlessly retry invalid business operations.

---

# 32. Dependency Handling

Example:

```text
OP-001 Create Beneficiary
OP-002 Create Land
OP-003 Create Application
OP-004 Record Usage
OP-005 Payment
```

If OP-001 fails:

```text
OP-002 → DEPENDENCY_BLOCKED
OP-003 → DEPENDENCY_BLOCKED
OP-004 → DEPENDENCY_BLOCKED
OP-005 → DEPENDENCY_BLOCKED
```

Do not submit OP-005 blindly.

---

# 33. Security Migration

Mandatory changes:

1. Remove hardcoded JWT secret fallback.
2. Move secrets to proper server secret management.
3. Remove auth tokens from localStorage.
4. Introduce device identity.
5. Introduce device revocation.
6. Implement object-level authorization.
7. Scope field agents to permitted geography/data.
8. Add rate limiting.
9. Validate all sync payloads server-side.
10. Never trust client financial totals.
11. Protect offline credentials.
12. Encrypt sensitive local data where feasible.
13. Audit high-risk operations.
14. Never bypass TLS validation.
15. Keep secrets out of Electron bundles.

---

# 34. Data Migration Strategy

## Step 1 — Snapshot

Create immutable V1 snapshot.

## Step 2 — Validate

Run:

- schema validation
- row counts
- foreign-key checks
- financial reconciliation
- orphan detection
- duplicate detection

## Step 3 — Transform

Only perform deterministic transformations.

Every transformation must have:

```text
source
destination
reason
transformation rule
validation
```

## Step 4 — Import

Import into staging PostgreSQL.

## Step 5 — Reconcile

Compare:

```text
SQLite
vs
PostgreSQL
```

for all important entities.

## Step 6 — Application Verification

Run the V2 server against migrated staging data.

## Step 7 — Pilot

Use a controlled subset of real operational users.

## Step 8 — Production

Only after reconciliation passes.

---

# 35. Migration of Historical Financial Records

Historical records should retain:

```text
original ID
original dates
original amounts
original rate snapshots
original statuses
original relationships
```

If a legacy running bill requires special treatment:

```text
is_legacy = true
legacy_classification = ...
```

Do not regenerate historical bills merely because the V2 formula is now different.

---

# 36. Schema Migration Rules

Every schema migration must:

1. Be forward migration.
2. Have rollback/recovery documentation.
3. Be tested on a copy.
4. Preserve existing IDs.
5. Preserve historical records.
6. Validate constraints.
7. Validate financial totals.
8. Be tested on Windows.
9. Be tested on macOS where supported.
10. Have a backup before execution.

Never use:

```text
drop database
```

or equivalent destructive reset in production migration.

---

# 37. Rollout Strategy

Recommended rollout:

## Stage A

V1 hardened desktop only.

No online dependency.

## Stage B

Server deployed.

V1 desktop remains operational.

Server receives migrated baseline.

## Stage C

Online-only pilot.

Selected users operate against server.

## Stage D

Online + local cache.

No offline writes yet.

## Stage E

Offline usage capture.

Only low-risk field operations initially.

## Stage F

Offline payment capture.

After payment sync tests pass.

## Stage G

Full controlled offline operations.

## Stage H

Multi-agent production.

---

# 38. Feature Flags

V2 rollout should use feature flags.

Examples:

```text
ONLINE_MODE_ENABLED
OFFLINE_MODE_ENABLED
SYNC_ENABLED
OFFLINE_USAGE_ENABLED
OFFLINE_PAYMENT_ENABLED
SERVER_BILLING_ENABLED
DEVICE_AUTH_ENABLED
```

A failed feature can be disabled without reverting the entire application.

---

# 39. Testing Gates

Every migration phase has a gate.

## Gate 1 — V1 Regression

All existing critical tests pass.

## Gate 2 — Data Migration

100% financial reconciliation.

## Gate 3 — Server

All online business workflows pass.

## Gate 4 — Authentication

Login, refresh, logout, revocation, role changes.

## Gate 5 — Offline

Device can:

- lose network
- record permitted operation
- restart
- recover operation
- reconnect
- sync

## Gate 6 — Duplicate

Repeat same operation 2, 5, 10 times.

Result:

```text
ONE business effect
```

## Gate 7 — Crash

Crash:

- before transaction
- during transaction
- after commit
- before response
- during sync
- after server acceptance

## Gate 8 — Conflict

Two devices modify/pay concurrently.

No silent corruption.

## Gate 9 — Recovery

Restore/reinstall/device replacement scenarios.

## Gate 10 — Production

Pilot users operate real workflows successfully.

---

# 40. Mandatory Chaos Tests

At minimum:

### Network

- disconnect before request
- disconnect during request
- disconnect after server commit
- reconnect during sync
- intermittent network

### Device

- application crash
- forced process termination
- OS shutdown
- battery loss
- restart during sync

### Database

- SQLite lock
- transaction rollback
- migration interruption
- corrupted backup
- invalid restore

### Financial

- duplicate payment
- concurrent payment
- overpayment
- reversal conflict
- stale bill
- stale usage
- duplicate usage

### Security

- revoked device
- disabled user
- expired token
- changed role
- invalid operation signature
- replayed operation
- altered payload

---

# 41. Observability

Server must expose operational diagnostics.

Minimum:

```text
sync operations received
sync operations accepted
sync operations rejected
sync conflicts
retry counts
device last sync
failed authentication
payment conflicts
server errors
database errors
```

Device diagnostics:

```text
network state
last successful sync
pending operations
failed operations
conflicts
local database health
device identity
app version
```

Never log:

- passwords
- access tokens
- refresh tokens
- payment secrets
- sensitive personal information unnecessarily

---

# 42. Conflict Resolution UI

Users must never see:

```text
Something went wrong.
```

for a meaningful business conflict.

Example:

```text
Payment could not be confirmed.

Bill: RB-2026-00124
Amount attempted: ₹7,000
Current server balance: ₹4,000

Reason:
Another payment was confirmed while this device was offline.

Status:
CONFLICT — ACTION REQUIRED
```

The user must then be given an authorized resolution workflow.

---

# 43. Device Replacement

A replacement device must not simply restore an old SQLite database and continue.

Recommended:

```text
Register new device
 ↓
Authenticate
 ↓
Download authoritative server state
 ↓
Apply required master data
 ↓
Recreate local cache
 ↓
Resume operation
```

Any old pending operations must be explicitly reconciled.

---

# 44. Server Outage

If server is unavailable:

```text
Device → OFFLINE
```

Permitted offline operations continue.

Sensitive server-only actions remain disabled.

When server returns:

```text
health check
 ↓
authenticate
 ↓
sync
 ↓
reconcile
 ↓
ONLINE
```

---

# 45. Client Update Strategy

Application updates must preserve:

```text
local database
outbox
device identity
pending operations
```

Never install an update that silently resets:

```text
SQLite
```

or:

```text
sync_outbox
```

Database migrations must be versioned and tested.

---

# 46. Server Version Compatibility

Client and server must exchange protocol/application versions.

Example:

```text
clientVersion
syncProtocolVersion
schemaVersion
```

Server should reject unsupported protocol versions clearly.

Do not allow an old client to submit unknown financial semantics.

---

# 47. Implementation Order

The actual implementation should proceed in this order:

```text
01. Freeze V1
02. Fix current financial race
03. Make audit transactional
04. Verify/add DB constraints
05. Harden clock validation
06. Generalize idempotency
07. Add version/revision model
08. Add stable device identity model
09. Build PostgreSQL schema
10. Build migration tooling
11. Migrate V1 data to staging
12. Reconcile staging data
13. Build central authentication
14. Build server RBAC/object authorization
15. Build online API
16. Connect pilot desktop online
17. Validate online financial workflows
18. Introduce local sync metadata
19. Introduce local outbox
20. Implement operation envelope
21. Implement server inbox/idempotency
22. Implement push sync
23. Implement pull/change feed
24. Implement conflict states
25. Implement offline usage
26. Test offline usage recovery
27. Implement controlled offline payments
28. Test payment concurrency
29. Implement device revocation
30. Redesign backup/restore
31. Add observability
32. Run chaos testing
33. Pilot multi-agent deployment
34. Production rollout
```

Do not reorder these merely to make development faster if the reordered plan weakens correctness.

---

# 48. What Must NOT Be Implemented First

Do NOT start with:

- UI redesign
- mobile application
- Redis
- Kubernetes
- microservices
- event bus
- cloud object storage
- automatic conflict merging
- background billing cron
- blind database synchronization
- direct PostgreSQL access from clients

The distributed financial core must be correct before infrastructure complexity is added.

---

# 49. Definition of Done for V2

V2 is not complete merely because:

```text
multiple devices can connect
```

It is complete only when:

### Offline

A device can lose the network and continue permitted work.

### Persistence

A crash/restart does not lose accepted local operations.

### Sync

Operations eventually reach the server.

### Idempotency

Retries cannot duplicate business effects.

### Financial Safety

Concurrent payments cannot violate balances.

### Conflict

Conflicting operations are explicitly represented.

### Security

Revoked users/devices cannot continue unrestricted operation.

### Authority

Server remains authoritative for shared financial state.

### Audit

Every accepted critical operation is traceable.

### Recovery

Backup/restore cannot silently resurrect stale financial state.

### Compatibility

Application updates preserve pending local work.

### Testing

Chaos and concurrency tests pass.

---

# 50. Production Invariants

These invariants must never be violated.

## Payment

```text
Valid Payment Sum <= Bill Amount
```

unless an explicit business rule permits otherwise.

## Running Bill

```text
Amount Due
=
Actual Usage
×
Rate Snapshot
```

## Development Bill

```text
Total Development Cost
=
Approved Litres
×
Development Rate Snapshot
```

## Installments

```text
SUM(Installments)
=
Development Bill Total
```

## Pending

```text
Pending
=
Due
-
Valid Payments
```

## Usage

```text
One authoritative usage
per allotment
per billing period
```

## Sync

```text
One operationId
=
one business effect
```

## Audit

```text
Accepted critical operation
=
corresponding authoritative audit record
```

## History

```text
Historical financial records
must never be silently rewritten
```

---

# 51. Migration Rollback Strategy

Every phase must define rollback independently.

Example:

### Server migration failure

Continue V1 local operation.

### Online pilot failure

Disable:

```text
ONLINE_MODE_ENABLED
```

and return users to the validated V1 path where appropriate.

### Sync failure

Disable:

```text
SYNC_ENABLED
```

without deleting the local outbox.

Pending operations remain preserved for investigation/recovery.

### Database migration failure

Restore the pre-migration snapshot and validate integrity before reopening the application.

Never solve migration failure by deleting the database.

---

# 52. Required Implementation Documents After This Plan

Before coding the complete V2, create implementation-level specifications for:

1. `V2-DATABASE-SCHEMA`
2. `V2-SYNC-SCHEMA`
3. `V2-API-CONTRACT`
4. `V2-AUTH-DEVICE-CONTRACT`
5. `V2-OFFLINE-OPERATION-MATRIX`
6. `V2-CONFLICT-CATALOG`
7. `V2-DATA-MIGRATION-SPEC`
8. `V2-BACKUP-RESTORE-SPEC`
9. `V2-TEST-AND-CHAOS-SPEC`
10. `V2-ELECTRON-RUNTIME-SPEC`

These documents should be implementation contracts, not high-level ideas.

---

# 53. Final Architecture

The final WaterGrid architecture should conceptually become:

```text
                         ┌──────────────────────────────┐
                         │        WATERGRID SERVER      │
                         │                              │
                         │ NestJS API                   │
                         │ Authentication               │
                         │ RBAC                         │
                         │ Domain Services              │
                         │ Billing                      │
                         │ Payments                     │
                         │ Sync Inbox                   │
                         │ Change Feed                  │
                         │ Audit                        │
                         │                              │
                         │ PostgreSQL                   │
                         └───────────────┬──────────────┘
                                         │
                                  HTTPS / TLS
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               │                         │                         │
        ┌──────▼──────┐           ┌──────▼──────┐           ┌──────▼──────┐
        │ DEVICE A    │           │ DEVICE B    │           │ DEVICE C    │
        │              │           │              │           │              │
        │ Electron     │           │ Electron     │           │ Electron     │
        │ Next.js      │           │ Next.js      │           │ Next.js      │
        │ Local API    │           │ Local API    │           │ Local API    │
        │ SQLite       │           │ SQLite       │           │ SQLite       │
        │ Outbox       │           │ Outbox       │           │ Outbox       │
        │ Sync Worker  │           │ Sync Worker  │           │ Sync Worker  │
        └──────────────┘           └──────────────┘           └──────────────┘
```

The most important boundary is:

```text
                 SERVER
                   │
          authoritative truth
                   │
        ┌──────────┴──────────┐
        │                     │
      ONLINE                OFFLINE
        │                     │
 immediate server        local pending
 authority               operations
        │                     │
        └──────────┬──────────┘
                   │
                 SYNC
                   │
          explicit acceptance,
          rejection or conflict
```

This preserves WaterGrid's strongest V1 property — local resilience — while removing its fundamental V1 limitation: the assumption that one local SQLite database can remain the authoritative source when multiple independent agents operate simultaneously.

---

# 54. Final Rule

The migration must optimize for:

```text
CORRECTNESS
    >
CONVENIENCE
    >
ARCHITECTURAL ELEGANCE
```

A temporarily offline system is acceptable.

A temporarily delayed payment is acceptable.

A visible synchronization conflict is acceptable.

A retry is acceptable.

A permanent duplicate payment, lost payment, silently overwritten bill, unauthorized operation, or contradictory financial history is NOT acceptable.

That principle governs every implementation decision in WaterGrid V2.
