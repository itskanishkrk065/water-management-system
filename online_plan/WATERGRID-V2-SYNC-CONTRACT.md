# WATERGRID V2 — SYNCHRONIZATION CONTRACT

**Document ID:** `WATERGRID-V2-SYNC-CONTRACT`  
**Version:** `1.0`  
**Status:** Architectural Baseline — Draft for Implementation Review  
**Depends On:**  
- `WATERGRID-V2-DOMAIN-CONTRACT`
- `WATERGRID-V2-OFFLINE-ONLINE-CONTRACT`

**Scope:** Client/server synchronization protocol for WaterGrid V2

---

# 1. Purpose

This document defines the authoritative synchronization protocol for WaterGrid V2.

It specifies how an Electron client with a local SQLite database communicates with the central WaterGrid server and how locally created operations become authoritative server state.

It covers:

- operation identity
- idempotency
- local outbox
- server inbox
- synchronization sessions
- cursors
- batching
- acknowledgements
- ordering
- dependency handling
- retries
- conflict detection
- conflict resolution
- server-side transactions
- pull synchronization
- push synchronization
- crash recovery
- duplicate prevention
- financial synchronization
- reconciliation
- integrity checks
- observability
- sync state machines

The protocol is designed around one principle:

> **A synchronization request may be delivered multiple times, but a successful business operation may be committed only once.**

---

# 2. Architectural Model

WaterGrid uses a local-first client with a central authoritative server.

```text
                    WATERGRID SERVER
                 ┌────────────────────┐
                 │ PostgreSQL          │
                 │ Domain Services     │
                 │ Auth/RBAC           │
                 │ Idempotency         │
                 │ Sync API            │
                 │ Audit               │
                 └─────────┬──────────┘
                           │
                     HTTPS / TLS
                           │
                ┌──────────┴──────────┐
                │                     │
             Device A              Device B
                │                     │
        ┌───────▼───────┐     ┌───────▼───────┐
        │ SQLite        │     │ SQLite        │
        │ Local State   │     │ Local State   │
        │ Outbox        │     │ Outbox        │
        └───────────────┘     └───────────────┘
```

The server is authoritative for shared state.

The local client is authoritative only for committed local work that has not yet synchronized.

---

# 3. Synchronization Is Operation-Based

WaterGrid must not synchronize arbitrary database row snapshots by blindly replacing server records.

Instead, synchronization uses explicit domain operations.

Examples:

```text
CREATE_BENEFICIARY
UPDATE_BENEFICIARY
CREATE_LAND_HOLDING
RECORD_WATER_USAGE
VERIFY_WATER_USAGE
CREATE_PAYMENT
VOID_PAYMENT
REQUEST_CORRECTION
```

The operation describes:

```text
what happened
who performed it
on which device
against which entity
with which version
using which operation ID
```

---

# 4. Operation Identity

Every synchronization operation receives an immutable:

```text
operationId
```

Recommended format:

```text
UUIDv7
```

or equivalent globally unique identifier.

The operation ID must remain unchanged across:

- retries
- reconnects
- application restarts
- network timeouts
- server response loss
- batch retries

A retry must never create a new operation ID.

---

# 5. Device Identity

Every installed WaterGrid client has a stable:

```text
deviceId
```

The server associates:

```text
deviceId
userId
installation
platform
appVersion
status
```

An operation therefore has:

```text
operationId
deviceId
actorUserId
```

This combination provides traceability.

---

# 6. Operation Envelope

Every synchronized operation must use a common envelope.

Conceptual structure:

```text
{
    operationId,
    deviceId,
    actorUserId,
    operationType,
    aggregateType,
    aggregateId,
    expectedVersion,
    clientCreatedAt,
    sequenceNumber,
    idempotencyKey,
    payload,
    metadata
}
```

### Required fields

| Field | Purpose |
|---|---|
| `operationId` | Globally unique operation identity |
| `deviceId` | Originating device |
| `actorUserId` | User who initiated operation |
| `operationType` | Domain command |
| `aggregateType` | Entity type |
| `aggregateId` | Target entity |
| `expectedVersion` | Optimistic concurrency check |
| `clientCreatedAt` | Local event time |
| `sequenceNumber` | Per-device ordering |
| `idempotencyKey` | Duplicate protection |
| `payload` | Operation-specific data |

The server assigns authoritative timestamps.

---

# 7. Idempotency

Idempotency is mandatory for every operation that can change state.

Especially:

- payments
- payment reversals
- usage records
- bills
- beneficiary creation
- land creation
- allocation changes

The server stores the result of processed operations.

Conceptually:

```text
operationId
idempotencyKey
requestHash
status
result
serverCommittedAt
```

---

# 8. Idempotency Protocol

First request:

```text
operationId = ABC
```

Server:

```text
No existing operation
      ↓
validate
      ↓
execute transaction
      ↓
store operation result
      ↓
COMMIT
```

Retry:

```text
operationId = ABC
```

Server:

```text
Operation exists
      ↓
verify request identity/hash
      ↓
return original result
      ↓
DO NOT execute again
```

This is the mechanism that protects against duplicate financial operations.

---

# 9. Request Hash Protection

An existing `operationId` must not be reused with different content.

Example:

First:

```text
operationId = ABC
amount = ₹5,000
```

Malicious or corrupted retry:

```text
operationId = ABC
amount = ₹8,000
```

Server must reject:

```text
IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD
```

The original operation remains authoritative.

---

# 10. Local Outbox

Every operation created offline or while temporarily disconnected enters:

```text
sync_outbox
```

Recommended fields:

```text
id
operationId
deviceId
actorUserId
operationType
aggregateType
aggregateId
payload
expectedVersion
sequenceNumber
status
attemptCount
nextAttemptAt
lastErrorCode
lastErrorMessage
createdAt
updatedAt
```

---

# 11. Outbox Atomicity

Business record creation and outbox creation must be one local transaction.

Example:

```text
BEGIN

INSERT WaterUsageRecord
INSERT SyncOutbox

COMMIT
```

Never:

```text
save record
      ↓
network call
      ↓
create outbox
```

because a crash can leave unsynchronizable local data.

---

# 12. Local Outbox State Machine

```text
PENDING
   |
   v
READY
   |
   v
IN_FLIGHT
   |
   +---------> ACKNOWLEDGED
   |
   +---------> RETRY_WAIT
   |
   +---------> CONFLICT
   |
   +---------> REJECTED
   |
   +---------> DEPENDENCY_BLOCKED
```

`ACKNOWLEDGED` operations remain available for reconciliation/history according to retention policy.

---

# 13. Server Inbox

The server should maintain a durable operation/inbox record.

Conceptual table:

```text
sync_operations
```

Fields:

```text
operationId
deviceId
actorUserId
operationType
aggregateType
aggregateId
requestHash
status
resultCode
resultPayload
serverReceivedAt
serverCommittedAt
createdAt
```

Possible statuses:

```text
RECEIVED
PROCESSING
ACCEPTED
ALREADY_ACCEPTED
REJECTED
CONFLICT
```

This provides durable idempotency and observability.

---

# 14. Per-Device Sequence Numbers

Each device maintains a monotonically increasing local sequence:

```text
1
2
3
4
...
```

This provides useful ordering information.

Example:

```text
Device A

sequence 101
sequence 102
sequence 103
```

The server must not assume that network arrival order equals creation order.

---

# 15. Sequence Number Rules

A device must never reuse a sequence number for a different operation.

If:

```text
sequence = 103
```

has already been assigned to operation A, operation B cannot use 103.

The server can detect:

```text
sequence reuse
missing sequence
unexpected sequence
```

for diagnostics.

Sequence numbers do not replace operation IDs.

---

# 16. Ordering

The synchronization engine should preserve causal ordering when dependencies exist.

Example:

```text
CREATE_BENEFICIARY
        ↓
CREATE_LAND_HOLDING
        ↓
CREATE_ALLOTMENT
        ↓
RECORD_USAGE
        ↓
CREATE/ISSUE BILL
        ↓
RECORD_PAYMENT
```

However, unrelated operations may synchronize independently.

The server should not serialize the entire system unnecessarily.

---

# 17. Dependency Graph

Each operation may declare dependencies.

Example:

```text
RECORD_WATER_USAGE
dependsOn:
    beneficiary creation
    allotment creation
```

If the dependency has not been accepted:

```text
DEPENDENCY_BLOCKED
```

The operation remains safely stored.

Once the dependency succeeds:

```text
operation becomes READY
```

---

# 18. Temporary vs Permanent Failures

Synchronization must distinguish technical failures from business failures.

## Temporary

```text
NETWORK_TIMEOUT
SERVER_UNAVAILABLE
CONNECTION_RESET
TEMPORARY_5XX
```

These may retry automatically.

## Permanent / Business

```text
PERMISSION_DENIED
STALE_VERSION
OVERPAYMENT
CLOSED_PERIOD
DUPLICATE_ENTITY
INVALID_STATE
DEVICE_REVOKED
VALIDATION_ERROR
```

These must not retry indefinitely.

---

# 19. Retry Policy

Retries use the same:

```text
operationId
idempotencyKey
payload
```

Recommended exponential backoff:

```text
attempt 1 → short delay
attempt 2 → longer delay
attempt 3 → longer delay
...
```

with a maximum retry interval.

Add jitter to avoid multiple devices reconnecting simultaneously and creating a synchronization spike.

---

# 20. Retry Safety

This is mandatory:

```text
retry != new operation
```

Example:

```text
Payment operation:
ABC

attempt 1:
ABC

attempt 2:
ABC

attempt 3:
ABC
```

Never:

```text
ABC
DEF
GHI
```

for the same user action.

---

# 21. Synchronization Session

Each sync cycle receives a session identity.

Conceptual:

```text
syncSessionId
deviceId
startedAt
completedAt
status
```

This allows diagnostics:

```text
Sync #1032
Started 10:42:11
Completed 10:42:16
Uploaded 12
Accepted 10
Conflicts 1
Rejected 1
Downloaded 37
```

---

# 22. Sync Protocol

Recommended high-level sequence:

```text
1. Establish HTTPS connection
2. Authenticate session
3. Verify device status
4. Request sync metadata
5. Upload pending operations
6. Receive per-operation results
7. Resolve accepted/rejected/conflict states
8. Download server changes
9. Apply changes transactionally
10. Update sync cursor
11. Run integrity checks
12. Mark session complete
```

The exact ordering can be optimized later, but financial correctness takes priority over throughput.

---

# 23. Push and Pull

Synchronization has two directions.

### Push

```text
Device → Server
```

for local operations.

### Pull

```text
Server → Device
```

for authoritative changes created by:

- other agents
- admins
- server workflows
- billing processes
- payment processing
- master-data changes

Both directions are required.

---

# 24. Server Change Feed

The server must expose a durable change feed or equivalent cursor-based mechanism.

Each authoritative change receives a monotonic server sequence:

```text
serverChangeSequence
```

Example:

```text
1001
1002
1003
...
```

The device stores:

```text
lastAppliedServerSequence
```

---

# 25. Pull Cursor

A client asks:

```text
Give me changes after sequence 5000.
```

Server returns:

```text
5001
5002
...
5030
```

Client applies them and advances:

```text
lastAppliedServerSequence = 5030
```

The cursor must advance only after the corresponding changes are safely committed locally.

---

# 26. Pull Atomicity

Downloaded changes must be applied transactionally.

Example:

```text
BEGIN LOCAL TRANSACTION

apply change 5001
apply change 5002
...
apply change 5030

update cursor = 5030

COMMIT
```

If the application crashes:

```text
ROLLBACK
```

The cursor does not advance.

On restart, the same changes can be requested again safely.

---

# 27. Idempotent Pull

The client must tolerate receiving a change more than once.

Possible causes:

- retry
- lost acknowledgement
- reconnect
- cursor recovery
- server resend

Applying the same server change twice must not corrupt local state.

---

# 28. Server Change Identity

Each server-side change should have a stable:

```text
changeId
```

and:

```text
serverSequence
```

The client can use both for diagnostics and duplicate protection.

---

# 29. Change Application Rules

A server change must not blindly overwrite local unsynchronized work.

Before applying:

```text
Does local pending operation affect same entity?
```

If no:

```text
apply server change
```

If yes:

```text
reconcile
```

The synchronization engine must understand that local pending work may be newer locally but not authoritative globally.

---

# 30. Local Pending Overlay

The UI may need to represent:

```text
Server state
+
local pending changes
```

Example:

```text
Server balance:
₹10,000 pending

Local payment:
₹2,000 PENDING_SYNC
```

UI can show:

```text
Server confirmed pending: ₹10,000
Local pending payment: ₹2,000
```

It must not falsely present:

```text
Server pending = ₹8,000
```

until the server confirms the payment.

---

# 31. Conflict Detection

Conflict occurs when an operation cannot safely apply against current server state.

Examples:

```text
STALE_VERSION
DUPLICATE_USAGE
OVERPAYMENT
CLOSED_PERIOD
INVALID_STATE
PERMISSION_CHANGED
TARIFF_CHANGED
ALLOCATION_CHANGED
```

The server returns a structured conflict.

---

# 32. Conflict Payload

A conflict should contain:

```text
operationId
conflictCode
aggregateType
aggregateId

clientVersion
serverVersion

clientPayload
serverState

serverTimestamp
resolutionHint
```

Example:

```text
{
    conflictCode: "STALE_VERSION",
    clientVersion: 14,
    serverVersion: 15
}
```

This makes conflicts diagnosable instead of generic API errors.

---

# 33. Financial Conflicts Are Never Auto-Merged

For:

- payments
- bills
- payment reversals
- approved allocations
- tariff changes

the system must not use:

```text
last-write-wins
```

or automatic field merging.

Financial conflicts require deterministic server-side resolution.

---

# 34. Beneficiary Profile Conflicts

Lower-risk fields may have controlled conflict resolution.

Example:

```text
Phone
Address
Email
```

Even here, the server must use version checking.

Automatic merge may be permitted only for explicitly defined non-critical fields.

---

# 35. Land Conflict Rules

Land data affects allocation and therefore has financial implications.

Changes to:

- declared area
- survey number
- subdivision
- project scheme

must use version-aware server validation.

If an offline land change conflicts with an authoritative change:

```text
CONFLICT
```

not silent overwrite.

---

# 36. Usage Conflict Rules

V2 rule:

```text
one allotment
+
one billing period
=
one authoritative usage record
```

If two operations compete:

```text
first accepted
second conflict
```

The second operation must remain auditable.

---

# 37. Payment Synchronization

Payment synchronization requires:

```text
operationId
idempotencyKey
billId
amount
paymentMode
actor
device
```

Server transaction:

```text
BEGIN

check operation idempotency
authenticate actor
authorize payment
load bill
verify bill state
calculate current pending balance
validate amount
insert payment
update bill balance/status
insert ledger entry
insert audit event
store operation result

COMMIT
```

---

# 38. Payment Synchronization — Lost Response

Scenario:

```text
Client → payment ₹5,000
Server → commits
Network → response lost
```

Client retries same operation:

```text
operationId = ABC
```

Server returns:

```text
ALREADY_ACCEPTED
original payment result
```

Expected:

```text
one payment
```

---

# 39. Payment Synchronization — Concurrent Agents

Example:

```text
Bill = ₹10,000

Agent A offline:
₹7,000

Agent B online:
₹6,000
```

Server accepts B.

When A syncs:

```text
server pending = ₹4,000
requested = ₹7,000
```

Result:

```text
OVERPAYMENT_CONFLICT
```

The server does not:

- create an overpayment
- silently reduce the payment
- overwrite B's payment
- change the bill to fit A's request

The operation remains unresolved until an authorized resolution workflow is executed.

---

# 40. Usage Synchronization

Offline agent:

```text
actual usage = 42,500 L
```

Local:

```text
WaterUsageRecord
status = PENDING_SYNC
```

Sync:

```text
server validates:
commissioned?
running start date?
period valid?
allotment valid?
duplicate?
allocation variance?
user authorized?
```

If accepted:

```text
usage becomes authoritative
```

Running bill generation follows server business rules.

---

# 41. Running Bill Synchronization

The official RunningBill is server-authoritative.

A client must not create competing bills due to:

- reconnect
- retry
- duplicate usage submission
- application restart
- lost server response

The server enforces:

```text
UNIQUE(allotmentId, billingPeriodId)
```

for the active financial obligation.

---

# 42. Billing and Sync Race

Possible scenario:

```text
Agent records usage offline
        ↓
Admin closes billing period online
        ↓
Agent synchronizes
```

The server decides whether the usage is still valid under the billing-period rules.

The client must not assume that a previously valid local operation remains valid forever.

Possible result:

```text
ACCEPTED
```

or:

```text
CLOSED_PERIOD
```

depending on authoritative business state.

---

# 43. Tariff Race

Scenario:

```text
Device last synced:
running rate = ₹0.50/L

Admin changes future tariff:
₹0.60/L

Device records usage
```

The server must resolve the applicable tariff based on the authoritative tariff/effective-date rules.

The device's cached tariff is a preview/reference, not permission to invent a financial result.

---

# 44. Snapshotting Financial Inputs

When a bill is created, server stores:

```text
usage snapshot
tariff snapshot
period
calculation breakdown
```

Therefore:

```text
future tariff changes
```

cannot alter:

```text
historical bill
```

---

# 45. Server Transaction Boundary

Each accepted financial operation must have one clear transaction boundary.

Example payment:

```text
BEGIN
  idempotency check
  authorization
  validation
  payment insert
  bill update
  ledger insert
  audit insert
  idempotency result insert
COMMIT
```

If any component fails:

```text
ROLLBACK
```

---

# 46. Sync API Transaction Boundary

The server may receive a batch of operations.

Important rule:

> **A batch is not automatically one financial transaction.**

Each operation should have its own domain transaction unless the operation explicitly requires atomic multi-command behavior.

Example:

```text
Batch:
A accepted
B accepted
C conflict
D rejected
```

This is valid.

The client must receive a result for each operation.

---

# 47. Batch Result

Example:

```text
SYNC SESSION 1042

A → ACCEPTED
B → ACCEPTED
C → CONFLICT
D → REJECTED
E → DEPENDENCY_BLOCKED
```

No ambiguous batch-level:

```text
SUCCESS
```

should hide individual outcomes.

---

# 48. Maximum Batch Size

The protocol should support bounded batches.

Example initial configuration:

```text
50–200 operations per request
```

Exact limit should be configurable and load-tested.

Large backlogs must be processed in chunks.

---

# 49. Pull Page Size

Server changes should also be paginated.

Example:

```text
GET changes after cursor 5000
limit 100
```

Response:

```text
changes
nextCursor
hasMore
```

The client continues until:

```text
hasMore = false
```

---

# 50. Sync Cursor Advancement

Never advance the local cursor before changes are committed.

Correct:

```text
download changes
      ↓
apply locally
      ↓
commit transaction
      ↓
advance cursor
```

Incorrect:

```text
receive changes
      ↓
advance cursor
      ↓
apply changes
```

The incorrect approach can cause permanent data loss after a crash.

---

# 51. Full Reconciliation

The system must support a deeper reconciliation operation.

Example:

```text
Device local checksum/state
        ↓
Server authoritative checksum/state
        ↓
Compare
```

If inconsistency is detected:

```text
RECONCILIATION_REQUIRED
```

The system can then:

```text
rebuild cache
replay pending operations
re-fetch authoritative state
```

without destroying unsynchronized work.

---

# 52. Reconciliation Is Not Blind Database Replacement

Prohibited:

```text
download server DB
replace local SQLite
```

because local pending work may be lost.

Instead:

```text
1. preserve outbox
2. validate local state
3. synchronize pending operations
4. refresh authoritative cache
5. rebuild derived data
6. verify integrity
```

---

# 53. Sync Integrity Checks

After synchronization, verify important invariants.

Examples:

```text
No duplicate active bill per allotment/period
Payment totals reconcile
Pending = amountDue - validPayments
No orphan usage
No orphan payment
Cursor monotonic
Outbox acknowledged states consistent
```

If integrity fails:

```text
SYNC_INTEGRITY_FAILURE
```

and the system must stop silently proceeding.

---

# 54. Offline Queue Recovery

If the application crashes while an operation is:

```text
IN_FLIGHT
```

on restart it should not automatically assume failure.

It should:

```text
retry same operationId
```

The server idempotency layer determines whether it was already committed.

---

# 55. Sync Locking

A device should prevent uncontrolled concurrent sync workers.

Use a local synchronization lock:

```text
SYNC_IDLE
      ↓
SYNC_RUNNING
      ↓
SYNC_COMPLETE
```

If the user opens multiple windows or the app triggers multiple sync events:

```text
one active sync worker
```

rather than multiple simultaneous outbox processors.

---

# 56. Background Sync

Background synchronization may run:

- on application startup
- when connectivity returns
- periodically while online
- after an operation is created

But it must obey:

```text
one sync coordinator
```

and must not interrupt an active financial transaction.

---

# 57. Manual Sync

Provide:

```text
Sync Now
```

for authorized users.

It should display:

```text
last sync
pending count
conflict count
failed count
```

Manual sync uses the same sync engine as automatic sync.

There must not be two separate synchronization implementations.

---

# 58. Offline Queue Visibility

Users should be able to inspect their own pending operations where appropriate.

Example:

```text
Sync Center

Pending       7
Syncing       1
Conflicts     2
Rejected      1
Last Sync     10:42 AM
```

Financial conflicts should be prominently visible to authorized staff.

---

# 59. Audit of Synchronization

Synchronization itself should be auditable.

Record:

```text
syncSessionId
deviceId
userId
startedAt
completedAt
uploadedCount
acceptedCount
conflictCount
rejectedCount
downloadedCount
failureCount
```

Financial operations additionally have their own domain audit records.

---

# 60. Security Requirements

Every synchronization request must be:

```text
HTTPS/TLS
authenticated
authorized
device-associated
```

The client must never be trusted merely because it supplies:

```text
actorUserId
role
deviceId
```

The server derives trusted identity from authenticated credentials/session.

Payload identity is metadata only and must be validated against the authenticated session.

---

# 61. Operation Tampering

The server must validate:

```text
authenticated user
authorized role
device association
operation type
aggregate ownership/access
payload
expected version
```

A client cannot elevate itself by changing:

```text
role = ADMIN
```

in an operation payload.

---

# 62. Server as Final Authority

For every operation:

```text
Client proposes operation
        ↓
Server validates
        ↓
Server decides
        ↓
Server commits or rejects
        ↓
Client converges
```

The client does not get to define authoritative truth.

---

# 63. Sync State Machine

Overall:

```text
                 ┌──────────────┐
                 │    OFFLINE   │
                 └──────┬───────┘
                        │
                   server reachable
                        │
                        v
                 ┌──────────────┐
                 │   CONNECTING │
                 └──────┬───────┘
                        │
                  authenticated
                        │
                        v
                 ┌──────────────┐
                 │   SYNCING    │
                 └──────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          v             v             v
       COMPLETE      CONFLICT      FAILED
          │             │             │
          v             v             v
        ONLINE       ATTENTION     RETRY_WAIT
```

---

# 64. Operation State Machine

```text
LOCAL_CREATED
      |
      v
PENDING
      |
      v
IN_FLIGHT
      |
      +-----------> ACCEPTED
      |
      +-----------> ALREADY_ACCEPTED
      |
      +-----------> RETRY_WAIT
      |
      +-----------> CONFLICT
      |
      +-----------> REJECTED
      |
      +-----------> DEPENDENCY_BLOCKED
```

---

# 65. Exactly-Once Semantics

The network itself cannot guarantee exactly-once delivery.

Therefore WaterGrid must implement:

```text
at-least-once delivery
+
idempotent server processing
```

which produces:

```text
exactly-once business effect
```

for operations designed to be idempotent.

This distinction is critical.

We do not attempt to make HTTP itself exactly-once.

We make the **business effect** exactly-once.

---

# 66. Ordering vs Exactly-Once

Ordering and idempotency are separate.

Example:

```text
operation A
operation B
```

If B arrives before A:

```text
B → DEPENDENCY_BLOCKED
A → ACCEPTED
B → retried
B → ACCEPTED
```

This is preferable to blindly accepting an invalid operation.

---

# 67. Server-Side Idempotency Retention

Idempotency records must be retained long enough to cover realistic retries and recovery.

Financial operation idempotency records should have stronger retention requirements than ordinary cache operations.

Deletion/expiry policies must not create a window where an old payment operation can be accidentally executed twice.

---

# 68. Device Database Recovery

If local SQLite becomes corrupted:

```text
1. preserve encrypted backup
2. preserve outbox if recoverable
3. perform integrity check
4. stop unsafe synchronization
5. recover/rebuild local cache
6. replay preserved pending operations
7. reconcile with server
```

Never simply delete the local database without preserving pending work.

---

# 69. Server Database Recovery

Server backup/restore is a separate infrastructure concern.

After server restoration:

```text
idempotency records
+
domain records
+
audit
+
change feed
```

must remain internally consistent.

If the server loses its operation history but retains financial records, synchronization must enter a controlled reconciliation state rather than blindly replaying all client operations.

---

# 70. Server Change Feed Recovery

The server's change sequence must remain monotonic across normal operation.

If a catastrophic recovery causes sequence discontinuity:

```text
RECONCILIATION_REQUIRED
```

may be triggered for affected clients.

Clients must not assume that a cursor remains valid if the server explicitly invalidates the synchronization epoch.

---

# 71. Sync Epoch

Recommended server concept:

```text
syncEpoch
```

A client stores:

```text
syncEpoch
lastServerSequence
```

If the server changes synchronization history incompatibly:

```text
syncEpoch changes
```

Client detects:

```text
EPOCH_MISMATCH
```

and performs controlled full reconciliation.

This protects against invalid cursors after major server recovery/migration events.

---

# 72. Full Resync

A full resync must follow:

```text
1. Stop normal sync
2. Preserve local outbox
3. Authenticate
4. Validate device
5. Obtain current sync epoch
6. Download authoritative cache data
7. Apply server state
8. Replay local outbox
9. Resolve conflicts
10. Rebuild indexes/derived state
11. Verify financial invariants
12. Resume normal sync
```

---

# 73. Derived Data

Derived values should be recalculable.

Examples:

```text
amountPaid
pendingAmount
dashboard totals
collection percentages
cached counts
```

Where appropriate, the authoritative source should remain:

```text
payment records
bill records
usage records
```

A synchronization process must be able to rebuild derived values.

---

# 74. Never Synchronize UI State as Business Truth

Do not synchronize:

```text
React Query cache
UI counters
selected tab
modal state
dashboard cards
```

Only domain state and explicit domain operations synchronize.

UI state is reconstructed from synchronized domain data.

---

# 75. Local Query Cache

The local application may use:

```text
SQLite
+
repository/service layer
+
React Query/UI cache
```

But the React Query cache is not authoritative persistence.

After synchronization:

```text
database updated
        ↓
invalidate affected queries
        ↓
refetch/recompute
```

This prevents stale UI after sync.

---

# 76. Sync Does Not Mean UI Refresh Everything

The client should invalidate only affected domains where practical.

Example:

```text
Payment accepted
```

invalidate:

```text
bill
payment ledger
beneficiary running charges
dashboard payment metrics
```

not every application query.

---

# 77. Sync Performance

The synchronization system must be designed for:

- many agents
- intermittent connectivity
- burst reconnects
- large backlogs
- bounded payloads

Use:

```text
pagination
batching
compression where appropriate
indexes
incremental change feeds
bounded retries
```

Do not load the entire database into memory.

---

# 78. Concurrency

Multiple devices may synchronize concurrently.

The server must use:

```text
database transactions
optimistic concurrency
unique constraints
row-level locking where necessary
```

especially for:

- payment balances
- bill status
- usage uniqueness
- allocation state
- device state

---

# 79. Payment Concurrency

For two simultaneous payments against the same bill:

```text
Bill = ₹10,000

A = ₹7,000
B = ₹5,000
```

The server must serialize the balance decision sufficiently to ensure:

```text
accepted payments <= ₹10,000
```

Possible result:

```text
A accepted
B rejected
```

or:

```text
B accepted
A rejected
```

depending on transaction order.

Never:

```text
both accepted
total = ₹12,000
```

unless an explicit overpayment feature exists.

---

# 80. Usage Concurrency

For:

```text
same allotment
same billing period
```

the database uniqueness constraint must protect against concurrent creation.

Application-level checks alone are insufficient.

Correct:

```text
service validation
+
database constraint
```

---

# 81. Conflict Does Not Mean Data Loss

When an operation conflicts:

```text
local operation remains
```

with:

```text
CONFLICT
```

The user can inspect it.

The system may later:

```text
retry
cancel
correct
create authorized replacement
```

according to business rules.

Never silently delete the operation because it failed.

---

# 82. Conflict Resolution Audit

Every conflict resolution should record:

```text
original operation
conflict reason
resolution action
resolver
timestamp
server state
result
```

For financial conflicts this is mandatory.

---

# 83. Manual Conflict Resolution

Only authorized users may resolve sensitive conflicts.

Example:

```text
Collection Agent
→ view own conflict

Accounts/Admin
→ resolve payment conflict
```

The exact RBAC mapping belongs to the security contract.

---

# 84. Sync Diagnostics

Developer/Admin diagnostics should expose:

```text
Device ID
User
App version
Server version
Connectivity state
Last successful sync
Last failed sync
Outbox count
Conflict count
Rejected count
Current server cursor
Sync epoch
Last server timestamp
```

Do not expose sensitive credentials or secrets.

---

# 85. Developer Sync Console

The existing Developer Portal should include a controlled Sync section:

```text
Sync Health
├── Connection
├── Last Sync
├── Outbox
├── Conflicts
├── Rejected
├── Cursor
├── Sync Epoch
├── Retry Queue
└── Diagnostics
```

A developer may inspect operation metadata.

Financial records must not be casually edited from a developer console.

---

# 86. Emergency Sync Stop

There should be an administrative mechanism to stop synchronization for a device or globally.

Examples:

```text
DEVICE_SYNC_BLOCKED
GLOBAL_SYNC_PAUSED
```

Use cases:

- discovered corruption
- compromised device
- bad deployment
- server migration
- emergency maintenance

Existing local data remains preserved.

---

# 87. App Version Compatibility

Operations should carry:

```text
appVersion
protocolVersion
schemaVersion
```

The server must be able to reject unsupported synchronization protocols safely.

Example:

```text
SYNC_PROTOCOL_UNSUPPORTED
```

rather than attempting to interpret unknown payloads.

---

# 88. Schema Migration Compatibility

A client database migration must preserve:

```text
outbox
pending operations
operation IDs
device identity
sync cursor
sync epoch
```

unless a controlled migration explicitly replaces them.

Database migration must not silently discard unsynchronized work.

---

# 89. Protocol Versioning

Recommended:

```text
syncProtocolVersion
```

Example:

```text
1
2
3
```

Backward compatibility should be maintained where practical.

Breaking changes require explicit version handling.

---

# 90. Network Security

All synchronization traffic must use:

```text
HTTPS/TLS
```

Never transmit synchronization payloads over plaintext HTTP in production.

Authentication credentials/tokens must not be embedded in source code.

---

# 91. Payload Validation

The server must validate every payload using:

```text
schema validation
+
domain validation
+
authorization
+
state validation
+
version validation
```

Never trust the client simply because it is an official WaterGrid application.

---

# 92. Sync API Error Contract

Errors must be machine-readable.

Example:

```text
{
    code: "OVERPAYMENT",
    operationId: "...",
    retryable: false,
    conflict: true,
    message: "...",
    serverStateVersion: 42
}
```

The client should make decisions from:

```text
code
retryable
conflict
```

not by parsing human-readable text.

---

# 93. Observability

Server logs must correlate:

```text
requestId
syncSessionId
operationId
deviceId
userId
aggregateId
```

This allows tracing:

```text
User
→ Device
→ Sync session
→ Operation
→ Transaction
→ Audit
```

without exposing sensitive information unnecessarily.

---

# 94. Monitoring Metrics

Production monitoring should include:

```text
sync_sessions_total
sync_failures_total
operations_accepted_total
operations_rejected_total
operations_conflicted_total
outbox_backlog
average_sync_latency
p95_sync_latency
payment_conflicts
duplicate_operation_attempts
device_revocations
```

Financial anomalies should trigger alerts according to the production monitoring policy.

---

# 95. Reconciliation Metrics

Track:

```text
devices with stale cursor
devices with pending backlog
devices with unresolved conflicts
devices failing repeated sync
devices with invalid local state
```

A device that has not synchronized for a long time should be visible to administrators.

---

# 96. Sync Completion Definition

A sync session is successful only when:

```text
all eligible pending operations have a terminal result
AND
all applicable server changes are applied
AND
cursor is safely advanced
AND
local integrity checks pass
```

A session with conflicts is not a complete clean sync.

It should report:

```text
COMPLETED_WITH_ATTENTION
```

rather than plain success.

---

# 97. Sync Result Categories

Recommended:

```text
SYNC_COMPLETE
SYNC_COMPLETE_WITH_ATTENTION
SYNC_RETRY_REQUIRED
SYNC_AUTH_REQUIRED
SYNC_DEVICE_REVOKED
SYNC_INTEGRITY_FAILURE
SYNC_EPOCH_MISMATCH
```

---

# 98. Example — Seven Pending Operations

```text
Outbox:

1 CREATE_BENEFICIARY
2 CREATE_LAND
3 RECORD_USAGE
4 RECORD_PAYMENT
5 RECORD_PAYMENT
6 UPDATE_BENEFICIARY
7 RECORD_USAGE
```

Server result:

```text
1 ACCEPTED
2 ACCEPTED
3 ACCEPTED
4 ACCEPTED
5 OVERPAYMENT_CONFLICT
6 STALE_VERSION
7 ACCEPTED
```

Client result:

```text
4 operations synchronized
2 need attention
1 pending/blocked
```

No operation disappears.

---

# 99. Example — App Crash During Payment Sync

```text
Payment operation:
ABC

Server:
commits payment

Client:
crashes before ACK
```

Restart:

```text
Outbox still contains ABC
        ↓
retry ABC
        ↓
server finds ABC
        ↓
ALREADY_ACCEPTED
        ↓
client updates local state
```

Expected:

```text
one payment
```

---

# 100. Example — App Crash During Pull

```text
Server sends changes 5001–5030
        ↓
Client applies 5001–5015
        ↓
Crash before commit
```

After restart:

```text
local cursor remains 5000
        ↓
request 5001 onward again
        ↓
apply transactionally
        ↓
cursor becomes 5030
```

No changes are lost.

---

# 101. Example — Server Response Lost After Bill Creation

If bill creation is itself an explicit server operation:

```text
operationId = BILL-ABC
```

and response is lost:

```text
retry BILL-ABC
```

The server returns the original result.

No second bill is created.

However, the preferred V2 architecture is that official RunningBills are generated by server-authoritative business logic from accepted/verified usage rather than independently generated by multiple clients.

---

# 102. Server-Generated Domain Events

Some events may originate entirely on the server.

Examples:

```text
RunningBillCreated
PaymentStatusChanged
BillingPeriodClosed
TariffActivated
```

These must enter the server change feed so every relevant device can receive them.

---

# 103. Device-Local Events

Some events originate locally and are later submitted:

```text
UsageRecorded
FieldNoteAdded
PaymentCapturedOffline
BeneficiaryDraftCreated
```

They become authoritative only after server acceptance.

---

# 104. Server Event Ordering

Server change sequence must reflect a deterministic ordering of committed changes.

For related financial events:

```text
Usage accepted
      ↓
Bill created
      ↓
Payment accepted
```

Devices should receive a causally valid representation.

---

# 105. Server Event Transactional Publication

A domain change must not be committed without its corresponding change-feed event being durable.

Recommended transactional pattern:

```text
BEGIN

update domain state
create audit event
create outbox/change-feed event
record idempotency result

COMMIT
```

This prevents:

```text
financial record exists
BUT
change event missing
```

---

# 106. Client Application of Server Events

When a server change is downloaded:

```text
validate event
validate entity
apply entity change
update local metadata
```

All relevant changes are committed atomically with cursor advancement.

---

# 107. No Direct Client-to-Client Synchronization

Devices must not directly exchange authoritative financial data.

Correct:

```text
Device A
   ↓
Server
   ↓
Device B
```

Not:

```text
Device A
   ↔
Device B
```

This keeps the authority model simple and secure.

---

# 108. Offline Backups

Local backups must include enough information to recover:

```text
local domain cache
pending outbox
device identity
sync metadata
```

They must not expose credentials/secrets.

Restoring a device backup must not duplicate old operations.

Operation IDs and idempotency remain intact.

---

# 109. Restored Device Scenario

Suppose:

```text
Device backup contains:
operation ABC
```

ABC was already synchronized before backup was restored.

After restore:

```text
ABC appears pending
```

Server receives ABC:

```text
already processed
```

Server returns original result.

Therefore restore does not duplicate the operation.

---

# 110. Duplicate Device Scenario

If a user clones a device installation:

```text
Device A
copied to Device B
```

the system must not allow both installations to masquerade as the same device.

Device identity must be installation-specific.

A restored/cloned installation must undergo controlled device registration/recovery.

---

# 111. Offline Queue Size

The client should monitor:

```text
outbox count
outbox storage size
oldest pending operation age
```

If thresholds are exceeded:

```text
warning
```

Example:

```text
⚠ 247 operations pending
Last successful sync: 3 days ago
```

The application remains safe but informs the user/admin.

---

# 112. Old Pending Operations

Very old operations must not be silently discarded.

If business validity has expired:

```text
operation → REJECTED / CONFLICT
```

with explicit reason.

Example:

```text
usage submitted after billing period closure
```

---

# 113. Sync Time and Financial Time

Do not confuse:

```text
operationCreatedAt
syncAttemptAt
serverReceivedAt
serverCommittedAt
```

A payment recorded offline on October 31 and synchronized November 2 remains associated with the business event/date captured according to the payment policy.

Server synchronization time must not silently rewrite the payment's business date.

---

# 114. Business Date Rules

Every operation that has a meaningful business date must explicitly define it.

Examples:

```text
Water usage → usage/collection date
Payment → payment date
Bill → billing period
Tariff → effective date
```

Synchronization timestamp is separate metadata.

---

# 115. Conflict Resolution Does Not Rewrite History

If a payment conflict is resolved:

```text
Original operation
       ↓
Conflict
       ↓
Authorized resolution
```

the audit history must preserve:

```text
original attempted action
conflict
resolution
final authoritative state
```

---

# 116. Data Integrity After Every Sync

At minimum verify:

```text
1. No duplicate active bills
2. No orphan payments
3. No negative pending balances
4. Payment totals reconcile
5. Usage references valid allotments
6. Billing periods valid
7. Tariff snapshots present on bills
8. Cursor is valid
9. Outbox state is consistent
10. No operation lost between local data and outbox
```

---

# 117. Sync Test Matrix

Before production, the synchronization system must test:

## Basic

```text
SYNC-001 Online sync
SYNC-002 Offline queue
SYNC-003 Reconnect
SYNC-004 Restart with pending queue
SYNC-005 Manual sync
```

## Idempotency

```text
SYNC-010 duplicate request
SYNC-011 lost response
SYNC-012 repeated payment
SYNC-013 repeated usage
SYNC-014 operation ID reuse with different payload
```

## Ordering

```text
SYNC-020 dependency ordering
SYNC-021 out-of-order arrival
SYNC-022 blocked dependency
SYNC-023 dependency retry
```

## Conflicts

```text
SYNC-030 stale beneficiary
SYNC-031 stale land
SYNC-032 duplicate usage
SYNC-033 concurrent payment
SYNC-034 allocation conflict
SYNC-035 tariff conflict
SYNC-036 closed-period conflict
```

## Failure

```text
SYNC-040 crash during push
SYNC-041 crash during pull
SYNC-042 server timeout
SYNC-043 connection reset
SYNC-044 partial batch
SYNC-045 repeated reconnect
```

## Recovery

```text
SYNC-050 database restore
SYNC-051 device restore
SYNC-052 server recovery
SYNC-053 sync epoch mismatch
SYNC-054 full reconciliation
```

## Security

```text
SYNC-060 expired session
SYNC-061 revoked device
SYNC-062 unauthorized operation
SYNC-063 tampered payload
SYNC-064 role changed while offline
```

---

# 118. Critical Financial Chaos Tests

These are mandatory.

## Test A — Lost Payment Response

```text
Server commits
response lost
client retries
```

Expected:

```text
exactly one payment
```

## Test B — Concurrent Payment

```text
Two agents
same bill
simultaneous payments
```

Expected:

```text
total accepted <= bill amount
```

## Test C — Duplicate Usage

```text
Two agents
same allotment
same billing period
```

Expected:

```text
one authoritative usage
```

## Test D — Crash During Sync

```text
server commits
client crashes
```

Expected:

```text
retry is safe
```

## Test E — Month Boundary

```text
offline Oct 31
reconnect Nov 1
```

Expected:

```text
October event remains October
```

---

# 119. Definition of Exactly-Once Financial Effect

For every financial operation:

```text
N network deliveries
        ↓
1 business effect
```

where:

```text
N >= 1
```

This is achieved through:

```text
stable operationId
+
idempotency
+
database transaction
+
unique constraints
+
server authority
```

---

# 120. Definition of Safe Synchronization

Synchronization is considered safe when:

```text
No accepted operation is duplicated
No committed operation is silently lost
No rejected operation is silently discarded
No financial record is silently overwritten
No stale client can bypass server validation
No cursor can skip unapplied changes
No retry creates a second business effect
No conflict is hidden
```

---

# 121. Final Synchronization Principle

WaterGrid synchronization is not:

```text
"upload the local database"
```

It is:

```text
LOCAL DOMAIN EVENTS
        ↓
DURABLE OUTBOX
        ↓
AUTHENTICATED SERVER
        ↓
IDEMPOTENT PROCESSING
        ↓
ATOMIC DOMAIN TRANSACTION
        ↓
AUTHORITATIVE SERVER STATE
        ↓
DURABLE CHANGE FEED
        ↓
CLIENT RECONCILIATION
        ↓
LOCAL CONVERGENCE
```

The server remains the final authority.

---

# 122. Implementation Gate

This document must be accepted before implementing the production synchronization layer.

The implementation must include, at minimum:

```text
Local outbox
Server inbox/idempotency
Operation IDs
Per-device sequencing
Dependency handling
Push synchronization
Pull synchronization
Server change cursor
Sync epoch
Retry engine
Conflict records
Conflict UI
Transactional pull application
Transactional financial commands
Integrity checks
Sync diagnostics
Protocol versioning
```

The next architectural document is:

`WATERGRID-V2-SECURITY-CONTRACT`

It must define authentication, authorization, offline sessions, token handling, device identity, credential storage, local database protection, role enforcement, payment authorization, device revocation, audit security, and attack/failure scenarios.

---

# 123. Final Rule

The network is unreliable.

The server is authoritative.

The client may retry.

The database must be atomic.

The operation ID must remain stable.

The user must never lose locally committed work.

And most importantly:

> **A synchronization failure may delay a financial operation, but it must never duplicate, corrupt, or silently rewrite the financial operation.**
