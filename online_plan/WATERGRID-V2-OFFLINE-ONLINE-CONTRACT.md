# WATERGRID V2 — OFFLINE / ONLINE BEHAVIOR CONTRACT

**Document ID:** `WATERGRID-V2-OFFLINE-ONLINE-CONTRACT`  
**Version:** `1.0`  
**Status:** Architectural Baseline — Draft for Implementation Review  
**Depends On:** `WATERGRID-V2-DOMAIN-CONTRACT`  
**Scope:** Runtime behavior when WaterGrid has reliable server connectivity, intermittent connectivity, or no connectivity

---

# 1. Purpose

This document defines exactly how WaterGrid V2 behaves when:

- fully online
- temporarily offline
- partially connected
- reconnecting
- synchronizing
- receiving conflicts
- receiving server rejections
- losing connectivity during an operation
- restarting while operations are pending

The purpose is to make offline capability a **controlled operational mode**, not a second independent application.

The system must satisfy:

> **Offline operation must never create a second source of financial truth.**

The client may continue useful work while offline, but the central server remains authoritative for shared state and financial truth.

---

# 2. Core Operating Principle

WaterGrid has one business domain and two execution environments:

```text
                    SHARED DOMAIN RULES
                           |
              +------------+------------+
              |                         |
        ONLINE EXECUTION          OFFLINE EXECUTION
              |                         |
         Server API              Local SQLite
              |                         |
              +------------+------------+
                           |
                      Sync Engine
```

There must never be:

```text
Online billing formula
        ≠
Offline billing formula
```

There must never be:

```text
Online payment rules
        ≠
Offline payment rules
```

The same domain rules are applied in both environments wherever offline execution is permitted.

---

# 3. Connectivity States

The application must expose four operational states.

## 3.1 ONLINE

Definition:

```text
Device has network connectivity
AND
WaterGrid server is reachable
AND
authentication/session is valid
```

Behavior:

- Server requests are permitted.
- Shared data can be refreshed.
- Server-authoritative operations can be performed.
- Pending local operations may synchronize.
- Financial operations can receive immediate server confirmation.

UI:

```text
● Online
Last sync: 10:42 AM
```

---

## 3.2 OFFLINE

Definition:

```text
WaterGrid server cannot be reached
```

Network connectivity alone does not mean ONLINE.

Behavior:

- Cached data remains available.
- Offline-permitted operations may continue.
- New operations are written locally.
- Every local operation requiring synchronization enters the outbox.
- Server-authoritative operations are disabled or clearly marked unavailable.
- No data is silently discarded.

UI:

```text
● Offline
7 operations pending synchronization
```

---

## 3.3 SYNCING

Definition:

```text
Server is reachable
AND
local pending operations are being uploaded/reconciled
```

Behavior:

- Outbox processing runs.
- Operations are sent using stable operation IDs.
- Retries reuse the same operation ID.
- Successful operations receive acknowledgement.
- Conflicts and rejections remain visible.
- Synchronization does not create duplicate operations.

UI:

```text
↻ Syncing
4 of 7 operations
```

---

## 3.4 DEGRADED / ATTENTION REQUIRED

Used when:

- server is reachable but authentication has expired
- sync has unresolved conflicts
- sync repeatedly fails
- device is revoked
- server rejects pending operations
- local integrity check detects a problem

UI example:

```text
⚠ Attention required
2 operations need review
```

The application must not claim ONLINE merely because a network connection exists.

---

# 4. Connectivity Detection

`navigator.onLine` or operating-system network state must never be treated as sufficient proof of WaterGrid availability.

Connectivity evaluation:

```text
Network available?
       |
       v
WaterGrid API reachable?
       |
       v
TLS/HTTPS connection valid?
       |
       v
Authentication/session valid?
       |
       v
Server health check successful?
       |
       +---- YES → ONLINE
       |
       +---- NO  → OFFLINE / DEGRADED
```

The health check must be lightweight and authenticated where appropriate.

---

# 5. No Internet Does Not Mean Data Loss

When offline:

```text
User action
    ↓
Local transaction
    ↓
Local database
    ↓
Outbox operation
```

The operation must not depend on the internet being available at the moment of entry.

Example:

```text
Agent records 42,500 L
        ↓
Internet unavailable
        ↓
Save locally
        ↓
PENDING_SYNC
```

The user must receive a clear confirmation that the data is stored locally.

---

# 6. Local Atomicity

Every offline operation that creates synchronized business state must write:

```text
business record
+
outbox operation
```

in the **same local database transaction**.

Conceptually:

```text
BEGIN LOCAL TRANSACTION

INSERT WaterUsageRecord
INSERT SyncOutbox

COMMIT
```

If the application crashes before commit:

```text
Neither exists
```

If commit succeeds:

```text
Both exist
```

This prevents:

```text
local record exists
BUT
sync operation missing
```

or:

```text
sync operation exists
BUT
business record missing
```

---

# 7. Offline-Safe Operations

The following may be supported offline, subject to the exact permissions of the authenticated user.

## 7.1 View Cached Data

Allowed:

- beneficiaries
- land holdings
- infrastructure
- allotments
- billing periods
- bills
- payment history
- usage history
- reports based on synchronized data

The UI must indicate when data is stale.

Example:

```text
Data last synchronized:
10:42 AM
```

---

## 7.2 Record Field Water Usage

Allowed offline.

Flow:

```text
Select beneficiary
        ↓
Select allotment
        ↓
Select billing period
        ↓
Record direct usage / meter reading
        ↓
Validate locally
        ↓
Save usage + outbox atomically
        ↓
PENDING_SYNC
```

The local application may calculate a preview.

The authoritative server determines final acceptance.

---

## 7.3 Field Notes

Allowed offline.

Notes are synchronized later.

---

## 7.4 Collection / Payment Capture

Offline payment capture may be allowed for authorized collection agents.

However:

> **Offline payment capture is not equivalent to server-confirmed payment.**

Local state:

```text
PENDING_SYNC
```

Server-confirmed state:

```text
VALID
```

The UI must clearly distinguish the two.

---

## 7.5 Beneficiary / Land Drafts

Offline creation may be allowed where business policy permits.

Such records remain:

```text
LOCAL_ONLY
```

or:

```text
PENDING_SYNC
```

until accepted by the server.

Offline creation must not silently claim that the record is globally authoritative.

---

# 8. Online-Only Operations

The following should be online-required in V2 unless explicitly redesigned:

- changing user roles
- creating/revoking users
- changing authentication policy
- tariff creation or activation
- changing approved water allocation
- reversing a payment
- voiding a financial transaction
- closing a billing period
- reopening a closed billing period
- device revocation
- resolving serious financial conflicts
- destructive master-data operations
- changing system-wide billing rules

Reason:

These operations affect shared authoritative state and are too conflict-sensitive to permit uncontrolled offline execution.

---

# 9. Running Charge Offline Behavior

The Running Charges domain follows:

```text
Commissioned Infrastructure
        ↓
Billing Period
        ↓
Field Collection
        ↓
Actual Usage
        ↓
Verification
        ↓
Running Bill
```

Offline operation can safely capture:

```text
Actual Usage
```

but the official financial bill should be server-authoritative.

Therefore:

```text
OFFLINE

WaterUsageRecord
      ↓
PENDING_SYNC
```

Then:

```text
ONLINE

Server validates usage
      ↓
Usage accepted
      ↓
Tariff resolved
      ↓
RunningBill created
```

The client must not independently create a competing official bill.

---

# 10. Offline Usage Validation

The device should perform immediate local validation:

```text
actualUsageLitres >= 0
```

For meter readings:

```text
currentMeter >= previousMeter
```

It should also check:

```text
infrastructure commissioned
runningChargeStartDate reached
billing period valid
allotment exists in local synchronized state
```

These checks improve UX.

However:

> **Local validation does not replace server validation.**

The server repeats all authoritative checks.

---

# 11. Approved Allocation During Offline Usage

The device may display the last synchronized:

```text
approvedLitres
```

and calculate:

```text
variance
```

Example:

```text
Approved: 60,000 L
Actual:   42,500 L
```

Normal.

If:

```text
Approved: 60,000 L
Actual:   65,000 L
```

the device displays:

```text
OVER_ALLOCATION
```

The device must not change the approved allocation to make the usage appear valid.

---

# 12. Offline Payment Behavior

An authorized agent may capture a payment while offline if the operation is explicitly permitted for that role.

Example:

```text
Bill pending:
₹10,000

Agent receives:
₹5,000 cash

Offline:
Payment created locally
status = PENDING_SYNC
```

The local UI can generate a receipt marked:

```text
OFFLINE — PENDING SERVER CONFIRMATION
```

It must not display:

```text
SERVER CONFIRMED
```

until synchronization succeeds.

---

# 13. Offline Payment Does Not Reserve Server Balance

This is critical.

Suppose:

```text
Bill = ₹10,000
```

Agent A is offline and records:

```text
₹7,000
```

Agent B is online and records:

```text
₹6,000
```

Server state:

```text
₹6,000 paid
₹4,000 pending
```

When Agent A synchronizes:

```text
Requested = ₹7,000
Server pending = ₹4,000
```

The server rejects the operation as an overpayment/conflict according to the payment resolution policy.

The local device must not overwrite the server balance.

---

# 14. Payment Confirmation States

The UI must distinguish:

```text
LOCAL_PENDING
SERVER_CONFIRMED
SERVER_REJECTED
CONFLICT
VOID_PENDING
REVERSED
```

Recommended user-facing labels:

```text
Pending Sync
Confirmed
Rejected
Needs Attention
Reversal Pending
Reversed
```

Never display a pending offline payment as fully confirmed.

---

# 15. Reconnection

When the server becomes reachable:

```text
OFFLINE
   ↓
CONNECTIVITY CHECK
   ↓
AUTHENTICATION CHECK
   ↓
SYNCING
```

The application must not immediately fire hundreds of independent requests.

Use controlled batching.

Example:

```text
Batch 1
Batch 2
Batch 3
...
```

with server acknowledgements.

---

# 16. Sync Ordering

Operations should normally be processed in dependency order.

Example:

```text
Create Beneficiary
       ↓
Create Land Holding
       ↓
Create Allotment
       ↓
Record Usage
       ↓
Create/accept Bill
       ↓
Record Payment
```

A child operation must not be submitted before its required parent identity exists on the server.

If dependencies are unresolved:

```text
WAITING_FOR_DEPENDENCY
```

rather than failing permanently.

---

# 17. Stable Operation Identity

Every synchronized operation requires an immutable:

```text
operationId
```

The same operation must retain the same ID through:

- retries
- reconnects
- application restart
- synchronization failures
- server timeout
- response loss

Example:

```text
operationId = DEVICE-ID + LOCAL-UUID
```

Never generate a new operation ID merely because a retry occurs.

---

# 18. Idempotency

The server must recognize previously processed operations.

Example:

```text
Request 1
operationId = ABC
```

Server:

```text
process
commit
store result
```

Response is lost.

Client retries:

```text
Request 2
operationId = ABC
```

Server:

```text
operation already processed
return original result
DO NOT execute again
```

This is mandatory for payments and all financial operations.

---

# 19. Outbox States

Each local synchronization operation should have an explicit state.

Recommended:

```text
PENDING
IN_FLIGHT
ACKNOWLEDGED
RETRY_WAIT
CONFLICT
REJECTED
DEPENDENCY_BLOCKED
CANCELLED
```

A successful operation must not remain indefinitely pending.

A failed operation must not silently disappear.

---

# 20. Retry Policy

Network failures are retryable.

Business validation failures are generally not.

Example:

### Retryable

```text
timeout
connection reset
temporary 5xx
server unavailable
```

### Not automatically retryable

```text
overpayment
duplicate business record
stale version
invalid tariff
closed billing period
permission denied
device revoked
```

A business rejection must be surfaced to the user.

---

# 21. Retry Must Be Idempotent

Bad:

```text
Retry
→ create new payment ID
```

Correct:

```text
Retry
→ same operationId
→ same idempotency key
```

The operation may be transmitted many times but can be committed only once.

---

# 22. Conflict Detection

Shared mutable entities use versioning.

Example:

```text
Beneficiary version = 14
```

Agent A downloads version 14.

Agent B changes it:

```text
14 → 15
```

Agent A later submits:

```text
expectedVersion = 14
```

Server:

```text
currentVersion = 15
```

Result:

```text
CONFLICT_STALE_VERSION
```

Agent A must not overwrite version 15.

---

# 23. Conflict Resolution

Conflicts must be explicit.

The UI should show:

```text
Your local version
Server version
Changed fields
Who changed it
When it changed
```

Resolution options depend on the entity.

For financial records:

```text
No silent merge
No last-write-wins
```

A controlled authorized correction is required.

---

# 24. Payment Conflicts

Payment conflicts are always server-resolved.

Example:

```text
Bill = ₹10,000

Local pending payment = ₹7,000
Server already received = ₹6,000
```

Server result:

```text
REJECTED_OVERPAYMENT
```

The system must retain:

- attempted amount
- operation ID
- actor
- device
- original local timestamp
- server decision
- reason

No data is deleted.

---

# 25. Usage Conflicts

For V1/V2:

```text
one allotment
+
one billing period
=
one authoritative usage record
```

If Agent A and Agent B submit competing usage:

```text
First authoritative acceptance
        ↓
Second operation
        ↓
CONFLICT
```

The second operation does not overwrite the first.

---

# 26. Tariff Changes

Tariff changes are server-authoritative.

Offline devices may display their last synchronized tariff.

They must not create or activate a new master tariff offline.

Existing bills always use their stored snapshot.

Future bills use the server-resolved tariff.

---

# 27. Approved Allocation Changes

Approved allocations are server-authoritative.

Offline devices may display the last synchronized value.

If the allocation changes while a device is offline:

```text
Server:
60,000 → 55,000
```

The device may still have:

```text
60,000
```

When it synchronizes usage, the server evaluates the operation against the current authoritative allocation and the snapshot/rules applicable to that usage event.

The device must not silently overwrite the new allocation.

---

# 28. Stale Cached Data

Cached data must carry freshness metadata.

Example:

```text
Beneficiary data
Last synced: 10:42 AM
```

For high-risk data, the UI should identify stale information.

Examples:

```text
Tariff last synced: 10:42 AM
Bill balance last synced: 10:42 AM
```

The application must not imply that stale data is current server truth.

---

# 29. Financial Data While Offline

The UI should distinguish:

```text
SERVER CONFIRMED
```

from:

```text
LOCAL / PENDING SYNC
```

Example:

```text
Bill:
₹10,000

Paid:
₹5,000 confirmed

Pending:
₹5,000

Local pending payment:
₹2,000
```

If relevant, show:

```text
₹2,000 awaiting server confirmation
```

Do not silently combine pending local amounts with authoritative server balance in a way that makes accounting ambiguous.

---

# 30. Reports While Offline

Offline reports are generated from the local synchronized snapshot.

They must indicate their data freshness when relevant.

Example:

```text
Report generated offline
Data synchronized through:
2026-10-03 10:42 AM
```

Financial reports requiring authoritative current totals should require online access.

---

# 31. Search While Offline

Search may operate against locally cached data.

If a beneficiary is not present locally:

```text
No result in offline data
```

must not be interpreted as:

```text
Beneficiary does not exist
```

The UI should communicate:

```text
Offline — search is limited to synchronized records.
```

---

# 32. New Beneficiary Offline

If allowed by policy:

```text
Create beneficiary
       ↓
LOCAL_ONLY
       ↓
Outbox
       ↓
PENDING_SYNC
```

Until server acceptance:

```text
beneficiary is not globally authoritative
```

If the server detects a duplicate phone or identity conflict:

```text
CONFLICT
```

The local record must remain recoverable.

---

# 33. New Land Holding Offline

If allowed:

```text
Create holding
       ↓
LOCAL_ONLY
       ↓
Outbox
```

Server validates:

- beneficiary
- project scheme
- survey uniqueness
- village hierarchy
- area consistency
- permissions

If rejected, the local operation becomes:

```text
REJECTED
```

not deleted.

---

# 34. Offline Deletion

Offline hard deletion is prohibited for historical/financial records.

For supported non-financial entities:

```text
deactivate
```

may be captured offline and synchronized later.

Server still performs final authorization.

---

# 35. Application Restart While Offline

Pending data must survive restart.

Example:

```text
Agent records 20 usage records
        ↓
App closes unexpectedly
        ↓
Restart
```

Expected:

```text
20 records still present
20 operations still pending
```

No duplicate operations should be generated.

---

# 36. Crash During Sync

Example:

```text
10 operations pending
        ↓
Sync operation 4 committed
        ↓
Application crashes
```

After restart:

```text
operations 1–3 = acknowledged
operation 4 = recognized by idempotency
operations 5–10 = retry
```

The system must converge without duplicates.

---

# 37. Server Timeout After Commit

This scenario must be explicitly supported.

```text
Client sends payment
        ↓
Server commits payment
        ↓
Network response lost
        ↓
Client sees timeout
```

Client must not assume:

```text
payment failed
```

It should retry using the same operation ID.

Server returns:

```text
already processed
```

and client transitions to:

```text
SERVER_CONFIRMED
```

---

# 38. Authentication While Offline

Offline authentication must be separately defined by the security contract.

At a minimum:

- no plaintext password storage
- cached offline session must have controlled lifetime
- local permissions must come from the last trusted authorization state
- sensitive administrative operations require online authorization
- revoked devices must stop synchronization when server connectivity returns

The application must never manufacture authorization locally.

---

# 39. Session Expiration

If the online session expires while offline:

```text
Existing local work
        ↓
remains safely stored
```

The application may allow explicitly permitted offline work to continue according to the security policy.

However:

```text
synchronization
```

must require valid server authentication.

Pending operations must remain in the outbox until the user re-authenticates.

---

# 40. Device Revocation

If the server marks a device:

```text
REVOKED
```

then when the device next connects:

```text
Server
 ↓
Device revoked
 ↓
Stop synchronization
 ↓
Invalidate active session
```

Local unsynchronized data must not be silently deleted.

It must be preserved according to the secure recovery policy.

---

# 41. Month Boundary

Billing periods are calendar-based.

If a device remains offline across:

```text
October → November
```

the device must derive the applicable period from dates, not from a timer.

Example:

```text
October 31
→ October period

November 1
→ November period
```

Previously recorded October usage remains associated with October.

Reconnection must not reassign it merely because synchronization happens in November.

---

# 42. Application Clock

The client must use a centralized date/time service.

It should maintain:

```text
lastKnownServerTime
lastSyncTime
localTime
clockOffsetEstimate
```

Financial operations should use server time after synchronization.

Suspicious clock rollback must be detected and audited.

---

# 43. No Timer-Based Billing

The application must not depend on:

```text
setInterval()
cron
background timer
app-open event
```

to create financial bills.

A bill is created because:

```text
verified usage exists
```

and the applicable billing rules permit bill generation.

Opening the app after six months must not create six months of fabricated bills.

---

# 44. Offline Reconciliation

When the app reconnects after a long period:

```text
Connect
   ↓
Authenticate
   ↓
Download authoritative changes
   ↓
Process local outbox
   ↓
Resolve dependencies
   ↓
Resolve conflicts/rejections
   ↓
Refresh local cache
   ↓
Verify integrity
```

The system must not blindly overwrite the local database.

---

# 45. Server Changes While Device Is Offline

Example:

```text
Device last synced:
approved allocation = 60,000

Server changes:
approved allocation = 55,000

Device remains offline.
```

On reconnect:

```text
Server state remains authoritative.
```

The synchronization engine must reconcile the difference before finalizing dependent operations.

---

# 46. Data Refresh After Synchronization

After successful synchronization:

```text
invalidate affected local queries
refresh affected records
update balances
update statuses
update timestamps
```

The UI must not continue displaying stale cached financial state after the server has returned a new authoritative result.

---

# 47. UI Rules for Offline State

The application should not block the entire interface merely because the internet is unavailable.

Instead:

```text
Available offline
        ↓
usable

Unavailable offline
        ↓
disabled with explanation
```

Example:

```text
Record Water Usage
[Enabled]

Change Tariff
[Disabled — Internet required]

Reverse Payment
[Disabled — Internet required]
```

---

# 48. No Silent Synchronization

The user should be able to inspect:

```text
Pending operations
Sync status
Last successful sync
Conflicts
Rejected operations
```

A background sync may happen automatically, but its result must be observable.

---

# 49. Sync Failure UX

Example:

```text
⚠ 3 operations need attention

1. Payment ₹7,000 — overpayment
2. Beneficiary update — stale version
3. Usage — billing period closed
```

Each should have:

```text
View
Reason
Resolve / Retry where permitted
```

The system must not repeatedly retry permanent business failures forever.

---

# 50. Offline Data Retention

Local data must have a defined retention policy.

At minimum:

- synchronized cache
- pending operations
- rejected operations
- conflict records
- local audit trail

must not be deleted merely because synchronization succeeded.

Retention/cleanup rules must be explicit.

---

# 51. Server-Authoritative Reconciliation

For shared records:

```text
Local state
     +
Server state
     ↓
Domain validation
     ↓
Authoritative server result
     ↓
Local state updated
```

Never:

```text
Local state
     ↓
overwrite server
```

without server-side validation.

---

# 52. Conflict Categories

Every synchronization problem should have a machine-readable category.

Recommended:

```text
STALE_VERSION
DUPLICATE_OPERATION
DUPLICATE_ENTITY
OVERPAYMENT
INVALID_STATE
PERMISSION_DENIED
CLOSED_PERIOD
TARIFF_CONFLICT
ALLOCATION_CONFLICT
DEVICE_REVOKED
AUTH_REQUIRED
DEPENDENCY_MISSING
VALIDATION_ERROR
```

This allows deterministic UI behavior and testing.

---

# 53. Operation Outcome Categories

Every synchronized operation should ultimately reach one of:

```text
ACCEPTED
ALREADY_ACCEPTED
REJECTED
CONFLICT
WAITING_FOR_DEPENDENCY
```

It must never remain indefinitely in an unexplained state.

---

# 54. Critical Rule — No Last-Write-Wins for Financial Data

The following is prohibited:

```text
Device A:
payment = ₹5,000

Device B:
payment = ₹7,000

latest timestamp wins
```

Financial state must be transactionally reconciled by the server.

The server evaluates each financial operation against current authoritative state.

---

# 55. Critical Rule — No Double Billing

The server must enforce:

```text
allotmentId
+
billingPeriodId
```

uniqueness for active RunningBills.

A reconnecting device must never generate another bill simply because:

```text
its local bill is missing
```

or:

```text
the previous response was lost
```

---

# 56. Critical Rule — No Double Payment

Payment processing must use:

```text
operationId
+
idempotency key
+
server transaction
```

A repeated request must return the original result rather than create another payment.

---

# 57. Critical Rule — No Lost Offline Work

A locally committed operation must be represented in:

```text
business data
+
outbox
```

within one local transaction.

If it is not synchronized:

```text
it remains recoverable
```

until explicit resolution.

---

# 58. Critical Rule — No Fake Confirmation

The client must never tell the user:

```text
Payment successful
```

when the payment exists only locally.

Use:

```text
Payment recorded offline.
Awaiting server confirmation.
```

This wording is essential for financial integrity.

---

# 59. Recommended Offline Status Banner

Global header:

```text
┌──────────────────────────────────────────────┐
│ WaterGrid     ● Offline                     │
│               7 operations pending          │
│               Last sync: 10:42 AM           │
└──────────────────────────────────────────────┘
```

Online:

```text
┌──────────────────────────────────────────────┐
│ WaterGrid     ● Online                      │
│               Synced just now               │
└──────────────────────────────────────────────┘
```

Syncing:

```text
┌──────────────────────────────────────────────┐
│ WaterGrid     ↻ Syncing                     │
│               4 / 7                         │
└──────────────────────────────────────────────┘
```

Attention:

```text
┌──────────────────────────────────────────────┐
│ WaterGrid     ⚠ Attention                   │
│               2 operations need review      │
└──────────────────────────────────────────────┘
```

---

# 60. Example — Complete Offline Usage Workflow

```text
Agent opens WaterGrid
        ↓
ONLINE
        ↓
Downloads assigned beneficiary data
        ↓
Internet fails
        ↓
OFFLINE
        ↓
Agent visits beneficiary
        ↓
Records 42,500 L
        ↓
Local validation
        ↓
SQLite transaction
    ├── Usage record
    └── Outbox operation
        ↓
PENDING_SYNC
        ↓
Agent continues working
        ↓
Internet returns
        ↓
SYNCING
        ↓
Server validates
        ↓
Server accepts usage
        ↓
Server creates authoritative bill
        ↓
ACK returned
        ↓
Local state updated
        ↓
SYNCED
```

---

# 61. Example — Complete Offline Payment Workflow

```text
Bill:
₹10,000

Agent receives:
₹5,000 cash
        ↓
Internet unavailable
        ↓
Payment captured locally
        ↓
PENDING_SYNC
        ↓
Receipt:
"Offline — Pending Confirmation"
        ↓
App remains usable
        ↓
Internet returns
        ↓
Sync
        ↓
Server validates balance
        ↓
Server transaction
    ├── Payment
    ├── Bill balance
    ├── Ledger
    └── Audit
        ↓
COMMIT
        ↓
ACK
        ↓
Payment = SERVER_CONFIRMED
```

---

# 62. Example — Lost Server Response

```text
Agent sends ₹5,000
        ↓
Server commits
        ↓
Internet response lost
        ↓
Client says:
"Sync uncertain"
        ↓
Retry same operationId
        ↓
Server recognizes operation
        ↓
Returns original result
        ↓
Client marks:
SERVER_CONFIRMED
```

Expected:

```text
Exactly one payment
```

---

# 63. Example — Concurrent Payment Conflict

```text
Bill = ₹10,000

Agent A offline:
₹7,000 pending

Agent B online:
₹6,000 confirmed

Agent A reconnects
        ↓
Server sees:
₹4,000 remaining
        ↓
₹7,000 cannot be accepted
        ↓
REJECTED_OVERPAYMENT
        ↓
Conflict retained
        ↓
Agent notified
```

Expected:

```text
No balance corruption
No duplicate payment
No silent partial acceptance
```

---

# 64. Example — Two Agents Record Usage

```text
Agent A:
42,500 L

Agent B:
43,000 L

Both offline
        ↓
Both synchronize
        ↓
First operation accepted
        ↓
Second:
USAGE_ALREADY_RECORDED
        ↓
Conflict
```

No silent overwrite.

---

# 65. Example — Device Offline Across Month Boundary

```text
Oct 31
Agent records usage
        ↓
Stored with October period
        ↓
Device offline
        ↓
Nov 1
        ↓
New current period = November
        ↓
October record remains October
        ↓
Later synchronization
        ↓
Server preserves original event period
```

---

# 66. Required Test Categories

Before production, the offline/online implementation must test at least:

### Connectivity

- online → offline
- offline → online
- unstable network
- server unavailable
- timeout
- DNS failure
- TLS failure

### Persistence

- app restart offline
- crash offline
- system shutdown
- laptop sleep/wake

### Synchronization

- normal sync
- retry
- duplicate retry
- partial sync
- interrupted sync
- batch failure
- dependency ordering

### Financial

- duplicate payment
- concurrent payment
- overpayment
- payment timeout
- payment response loss
- payment reversal
- bill duplication

### Conflict

- stale beneficiary
- stale land
- duplicate usage
- changed allocation
- changed tariff
- closed period

### Security

- expired session
- revoked device
- disabled user
- changed role
- offline session
- reauthentication

### Calendar

- month boundary
- long offline duration
- clock rollback
- incorrect local clock
- server time correction

---

# 67. Definition of Successful Offline/Online Behavior

WaterGrid V2 is considered operationally correct only when:

```text
Offline work is not lost
AND
Online work is not overwritten
AND
Retries do not duplicate operations
AND
Financial transactions are atomic
AND
Conflicts are explicit
AND
Server remains authoritative
AND
Historical records remain immutable
AND
Users can understand synchronization state
AND
Authentication remains secure
AND
The application converges to one authoritative state
```

---

# 68. Final State-Convergence Principle

The system must converge toward:

```text
               ONE AUTHORITATIVE SERVER STATE
                            ▲
                            |
                    synchronization
                            |
             +--------------+--------------+
             |                             |
          Device A                      Device B
          local state                   local state
```

Temporary differences are allowed.

Permanent contradictory financial truth is not.

The goal is not to prevent every possible offline conflict.

The goal is to make every possible conflict:

1. detectable,
2. deterministic,
3. recoverable,
4. auditable,
5. non-destructive,
6. financially safe.

---

# 69. Implementation Gate

This document must be accepted before implementing:

- local outbox
- sync engine
- conflict resolver
- online/offline UI
- offline payment capture
- offline usage capture
- server reconciliation

The next architectural document is:

`WATERGRID-V2-SYNC-CONTRACT`

That document must define the actual synchronization protocol, including operation envelopes, idempotency, outbox/inbox, cursors, batching, acknowledgements, dependency ordering, retry policy, conflict payloads, and reconciliation algorithms.

