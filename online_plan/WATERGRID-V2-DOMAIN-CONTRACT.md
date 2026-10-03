# WATERGRID V2 — DOMAIN CONTRACT

**Document ID:** `WATERGRID-V2-DOMAIN-CONTRACT`  
**Version:** `1.0`  
**Status:** Architectural Baseline — Draft for Implementation Review  
**Scope:** WaterGrid online + offline multi-agent platform  
**Primary authority:** Central WaterGrid server for shared and financial truth  
**Client:** Electron desktop application with local SQLite offline store

---

# 1. Purpose

This document defines the authoritative business domain model for WaterGrid V2 before implementation of the online/offline synchronization architecture.

It defines:

- entities and their ownership
- relationships
- identifiers
- lifecycle states
- immutable and mutable data
- financial invariants
- historical-data rules
- concurrency rules
- offline-safe operations
- server-authoritative operations
- deletion/deactivation rules
- billing and payment relationships
- audit requirements

This document is a **domain contract**, not a UI specification and not a synchronization protocol.

Synchronization rules are defined separately in:

`WATERGRID-V2-SYNC-CONTRACT`

Online/offline behavior is defined separately in:

`WATERGRID-V2-OFFLINE-ONLINE-CONTRACT`

Security/authentication is defined separately in:

`WATERGRID-V2-SECURITY-CONTRACT`

---

# 2. Architectural Principle

WaterGrid V2 uses the following authority model:

```text
                    WATERGRID SERVER
                          |
              Central authoritative state
                          |
        +-----------------+-----------------+
        |                 |                 |
     Device A          Device B          Device C
     SQLite            SQLite            SQLite
```

The server is authoritative for:

- shared records
- financial records
- official bills
- official payments
- tariffs
- approved allocations
- roles and permissions
- billing-period state
- audit history
- master data

A device is authoritative only for:

- locally created unsynchronized work
- local drafts
- locally queued operations

A local record must never silently overwrite authoritative server state.

---

# 3. Global Domain Rules

## 3.1 Identity

Every major entity must have an immutable globally unique identifier.

Recommended:

```text
UUID / UUIDv7
```

IDs must never be reused.

Phone numbers, survey numbers, receipt numbers, bill numbers, and names are **not primary keys**.

---

## 3.2 Money

Money must never depend on JavaScript floating-point arithmetic.

Use:

```text
Decimal / integer minor units
```

with a clearly defined currency precision.

For Indian Rupees:

```text
₹1.00 = 100 paise
```

All financial calculations must use deterministic decimal arithmetic.

---

## 3.3 Water Quantity

Water quantities are stored as liters.

```text
1 unit = 1 litre
```

Do not store water amounts as formatted strings.

Example:

```text
42500
```

represents:

```text
42,500 L
```

---

## 3.4 Rates

Running tariff:

```text
₹/L
```

Development tariff:

```text
₹/L
```

Rates must be stored as exact decimal values and snapshotted into financial records.

Changing a master tariff must never alter an already-created bill.

---

## 3.5 Historical Immutability

Historical financial records must not be silently edited.

For:

- bills
- payments
- payment ledger entries
- approved allocations
- tariff snapshots
- usage records that have driven bills
- financial calculations

corrections must use an explicit correction, void, reversal, or reissue workflow.

Never use hard deletion to hide a financial event.

---

# 4. Core Entity Map

```text
District
   |
Panchayat
   |
Village
   |
Beneficiary
   |
   +---- LandHolding
   |        |
   |        +---- SurveyParcel
   |
   +---- WaterAllotment
             |
             +---- Infrastructure
             |
             +---- BillingPeriod
                      |
                      +---- WaterUsageRecord
                               |
                               +---- RunningBill
                                        |
                                        +---- Payment
                                                 |
                                                 +---- PaymentLedgerEntry
```

Supporting entities:

```text
User
Role
Device
ProjectScheme
Tariff / RateConfiguration
AuditEvent
Document
SyncOperation
```

---

# 5. Location Domain

## 5.1 District

Fields:

```text
id
lgdDistrictCode
name
isActive
createdAt
updatedAt
```

### Rules

- `id` is immutable.
- `lgdDistrictCode` is unique.
- District cannot be hard-deleted if referenced historically.
- Deactivation prevents new assignments.
- Historical beneficiaries retain their district reference.

---

# 5.2 Panchayat

The application uses the term **Panchayat**.

The official LGD field remains:

```text
lgdBlockCode
```

Fields:

```text
id
districtId
lgdBlockCode
name
isActive
createdAt
updatedAt
```

Rules:

- Panchayat belongs to exactly one district.
- `lgdBlockCode` is unique within the applicable authority.
- A panchayat cannot be moved casually after historical use.
- Deactivation prevents new assignments but preserves history.

---

# 5.3 Village

Fields:

```text
id
panchayatId
lgdVillageCode
name
isActive
createdAt
updatedAt
```

Rules:

- Village belongs to exactly one panchayat.
- `lgdVillageCode` is unique.
- Deactivated villages remain available for historical records.
- New beneficiary records cannot select inactive villages.

---

# 6. Beneficiary

The beneficiary is the primary human/business subject receiving water allocation and related infrastructure services.

Fields:

```text
id
beneficiaryCode
fullName
phone
email
address
districtId
panchayatId
villageId
status
createdAt
updatedAt
```

Recommended statuses:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Separate account status:

```text
ACCOUNT_ACTIVE
ACCOUNT_LOCKED
ACCOUNT_DISABLED
```

### Rules

- `id` is immutable.
- Phone is an identifier/search field, not the primary key.
- Duplicate phone detection must occur during creation.
- If an existing beneficiary is found, the system should offer adding land rather than creating an unnecessary duplicate.
- Location hierarchy must be server-validated.
- Beneficiary deactivation does not delete historical financial records.
- An inactive beneficiary must not automatically cause historical records to disappear.

---

# 7. LandHolding

A beneficiary may own/manage multiple land holdings.

Fields:

```text
id
beneficiaryId
projectSchemeId
declaredAreaAcres
status
createdAt
updatedAt
```

Statuses:

```text
ACTIVE
INACTIVE
ARCHIVED
```

### Rules

- A beneficiary may have multiple holdings.
- Only active holdings participate in new allocation calculations.
- Historical water/allocation calculations must preserve the land basis used at that time.
- Deactivation is preferred over deletion.
- Existing financial records must not change because a holding is later deactivated.

---

# 8. SurveyParcel

A holding may contain multiple survey/SF numbers and subdivisions.

Fields:

```text
id
landHoldingId
surveyNumber
subdivisionNumber
areaAcres
status
```

### Uniqueness

The applicable uniqueness identity is:

```text
landHoldingId
+
surveyNumber
+
subdivisionNumber
```

A survey number may therefore occur multiple times when subdivision differs.

### Area invariant

```text
SUM(active parcel areas)
=
declared holding area
```

subject to an explicitly defined decimal tolerance.

The system must reject or flag inconsistent land totals according to the configured validation policy.

---

# 9. ProjectScheme

Project Scheme is master data.

Fields:

```text
id
code
name
description
isActive
createdAt
updatedAt
```

Rules:

- Only active schemes can be selected for new holdings.
- Historical holdings retain their original scheme.
- Deactivation does not rewrite historical records.
- Codes must be unique.

---

# 10. WaterAllotment

A WaterAllotment represents the approved water entitlement/application associated with a beneficiary/land context.

Fields:

```text
id
beneficiaryId
landHoldingId
requiredLitres
calculatedLitres
approvedLitres
litresPerAcreSnapshot
eligibleLandAcresSnapshot
status
approvedBy
approvedAt
createdAt
updatedAt
```

Possible statuses:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
CANCELLED
VOIDED
HISTORICAL
```

---

## 10.1 Allocation Formula

The calculated allocation is:

```text
calculatedLitres
=
applicableLitresPerAcre
×
eligibleLandAcres
```

Important:

```text
requiredLitres
≠
calculatedLitres
≠
approvedLitres
```

These represent different concepts.

### Required

What the beneficiary requests.

### Calculated

What the system calculates from the applicable land/rate rule.

### Approved

What the authorized administrator actually approves.

For operational control:

```text
approvedLitres
```

is authoritative.

---

## 10.2 Running Charges relationship

Approved allocation is **not the running-charge billing multiplier**.

Running billing uses:

```text
actualUsageLitres × runningRate
```

Approved allocation is used for variance checking:

```text
actualUsageLitres > approvedLitres
```

which creates an exception requiring the defined review policy.

---

# 11. Infrastructure

Infrastructure determines whether running-water service is operationally available.

Fields:

```text
id
beneficiaryId / allotmentId
status
plannedDate
constructionStartDate
completionDate
commissionedDate
runningChargeStartDate
createdAt
updatedAt
```

Statuses may include:

```text
PLANNED
UNDER_CONSTRUCTION
COMPLETED
COMMISSIONED
SUSPENDED
DECOMMISSIONED
```

### Running eligibility

A beneficiary/allotment becomes eligible for running usage only when:

```text
infrastructure.status = COMMISSIONED
```

and:

```text
usage date >= runningChargeStartDate
```

Commissioning is an **eligibility gate**, not a billing multiplier.

---

# 12. BillingPeriod

WaterGrid uses fixed calendar billing periods.

Example:

```text
2026-10
2026-11
2026-12
```

Fields:

```text
id
periodCode
periodStart
periodEnd
collectionStart
collectionEnd
paymentDueDate
status
createdAt
closedAt
```

Statuses:

```text
OPEN
COLLECTION
BILLING
PAYMENT
CLOSED
```

Exact transitions will be defined in the online/offline contract.

### Period invariant

A billing period represents a calendar month.

Example:

```text
2026-10-01
through
2026-10-31
```

No timer is required.

The current period is derived from the authoritative calendar date.

---

# 13. WaterUsageRecord

This is the **driving event of the new Running Charges model**.

Fields:

```text
id
beneficiaryId
allotmentId
infrastructureId
billingPeriodId
collectionAgentId

measurementMode
previousMeterReading
currentMeterReading
actualUsageLitres

approvedLitresSnapshot
varianceLitres
varianceStatus

collectionDate
usagePeriodStart
usagePeriodEnd

status

notes
verifiedBy
verifiedAt

createdAt
updatedAt
```

Measurement modes:

```text
DIRECT
METER
```

---

## 13.1 Direct Usage

Agent directly records:

```text
actualUsageLitres
```

Example:

```text
42,500 L
```

---

## 13.2 Meter Usage

Formula:

```text
actualUsageLitres
=
currentMeterReading
-
previousMeterReading
```

Rules:

```text
current >= previous
```

Negative usage is invalid.

---

## 13.3 Usage Variance

At recording time:

```text
varianceLitres
=
actualUsageLitres
-
approvedLitresSnapshot
```

If:

```text
actualUsageLitres <= approvedLitresSnapshot
```

normal.

If:

```text
actualUsageLitres > approvedLitresSnapshot
```

flag:

```text
OVER_ALLOCATION
```

The system must not silently change the approved allocation.

---

## 13.4 Usage lifecycle

Recommended:

```text
DRAFT
RECORDED
SUBMITTED
VERIFIED
REJECTED
CORRECTED
VOIDED
```

A bill requires:

```text
status = VERIFIED
```

---

# 14. WaterUsageRecord Uniqueness

For V1:

```text
UNIQUE(
    allotmentId,
    billingPeriodId
)
```

There must be one authoritative monthly usage record per allotment.

If correction is necessary, use a controlled correction/revision workflow.

Do not create competing usage records and choose whichever one happens to be newest.

---

# 15. Running Tariff / RateConfiguration

Running tariff is a versioned master configuration.

Conceptual fields:

```text
id
rateType
ratePerLitre
versionCode
effectiveFrom
effectiveTo
isActive
createdBy
createdAt
```

Rate type:

```text
RUNNING
DEVELOPMENT
```

The running-charge engine must resolve only:

```text
rateType = RUNNING
```

Development rates must never enter running-charge calculations.

---

# 16. Tariff Snapshot Rule

When a RunningBill is created, store:

```text
runningCostPerLitreSnapshot
tariffId
tariffVersionSnapshot
```

After creation:

```text
tariff master changes
        ↓
existing bill
        ↓
UNCHANGED
```

Historical financial records are immutable.

---

# 17. RunningBill

RunningBill is a financial consequence of verified actual usage.

Fields:

```text
id
billNumber

beneficiaryId
allotmentId
billingPeriodId
usageId

actualUsageLitresSnapshot
runningCostPerLitreSnapshot
tariffVersionSnapshot

amountDue
amountPaid
pendingAmount

dueDate
status

calculationBreakdown

isLegacy
legacyClassification

createdAt
updatedAt
```

---

# 18. Running Bill Formula

The authoritative formula is:

```text
amountDue
=
actualUsageLitresSnapshot
×
runningCostPerLitreSnapshot
```

Example:

```text
42,500 L
×
₹0.50/L
=
₹21,250
```

Approved allocation does not multiply the tariff.

---

# 19. RunningBill Hard Invariants

A new RunningBill cannot exist without:

```text
verified WaterUsageRecord
```

Therefore:

```text
NO USAGE
    ↓
NO BILL
```

Also:

```text
ONE ALLOTMENT
+
ONE BILLING PERIOD
=
MAX ONE ACTIVE RUNNING BILL
```

Recommended database constraint:

```text
UNIQUE(
    allotmentId,
    billingPeriodId
)
```

Legacy records must be handled separately so that historical data does not interfere with the new V1/V2 uniqueness rules.

---

# 20. RunningBill Lifecycle

Recommended:

```text
DRAFT
ISSUED
PARTIALLY_PAID
PAID
OVERDUE
VOIDED
```

Rules:

- `VOIDED` bills remain in history.
- A voided bill must have an audit reason.
- A replacement bill must be explicitly linked to the original.
- Amounts of issued financial records must not be silently overwritten.

---

# 21. RunningBill Calculation Breakdown

The bill should preserve a deterministic calculation breakdown.

Example:

```text
Billing period: 2026-10
Actual usage: 42,500 L
Running tariff: ₹0.50/L
Amount: ₹21,250
```

The stored breakdown must reconcile exactly to:

```text
amountDue
```

---

# 22. Payment

Payment represents money received against a bill.

Fields:

```text
id
paymentNumber
billId
beneficiaryId

amount
paymentMode

referenceNumber
receiptNumber
notes

status

createdBy
createdAt
updatedAt
```

Payment modes:

```text
CASH
BANK_TRANSFER
CHEQUE
UPI
OTHER
```

Statuses should include at least:

```text
VALID
VOIDED
REVERSED
```

---

# 23. Payment Rules

A payment must satisfy:

```text
amount > 0
```

and:

```text
amount <= current pending balance
```

unless a separately authorized overpayment policy exists.

For V1:

```text
OVERPAYMENT = REJECT
```

---

# 24. Payment Atomicity

Recording a payment must be one transaction.

Conceptually:

```text
BEGIN

validate bill
validate payment
validate balance
create payment
update bill balance/status
create ledger entry
create audit event
store idempotency result

COMMIT
```

Failure:

```text
ROLLBACK
```

No partial financial state is allowed.

---

# 25. Payment Immutability

Payments must never be hard-deleted.

If an error occurs:

```text
VALID
  ↓
REVERSAL
```

or:

```text
VALID
  ↓
VOIDED
```

with:

- reason
- authorized actor
- timestamp
- audit record
- relationship to original payment

---

# 26. Payment Ledger

The payment ledger provides the chronological financial record.

It must reconcile with payment records.

Core invariant:

```text
Total valid payments
=
RunningBill.amountPaid
```

For each bill:

```text
pending
=
amountDue
-
validPayments
```

---

# 27. Financial Invariants

These are non-negotiable.

## Running bill

```text
amountDue
=
actualUsageLitresSnapshot
×
runningCostPerLitreSnapshot
```

## Payment balance

```text
amountPaid
=
SUM(valid payment amounts)
```

## Pending

```text
pending
=
amountDue - amountPaid
```

## Fully paid

```text
pending = 0
```

## Partial

```text
0 < amountPaid < amountDue
```

## No payment

```text
amountPaid = 0
pending = amountDue
```

---

# 28. Date Semantics

WaterGrid must distinguish:

```text
usage date
billing period
bill creation date
bill due date
payment date
server transaction date
device-created date
```

They must never be treated as interchangeable.

Example:

An October bill paid on November 3:

```text
Billing period = 2026-10
Payment date = 2026-11-03
```

The October bill remains an October bill.

---

# 29. Server Time vs Device Time

The server is authoritative for committed financial timestamps.

A device may record:

```text
deviceCreatedAt
```

but after synchronization the server records:

```text
serverReceivedAt
serverCommittedAt
```

Both may be retained for audit.

Device clock manipulation must not rewrite authoritative server history.

---

# 30. User

Fields:

```text
id
username
fullName
phone
email
passwordHash
status
createdAt
updatedAt
```

Passwords are never stored in plaintext.

---

# 31. Role

Core roles:

```text
ADMIN
FIELD_OFFICER
COLLECTION_AGENT
ACCOUNTS
VIEWER
BENEFICIARY
```

Exact permissions are defined separately in the security contract.

Role assignment is server-authoritative.

---

# 32. Device

Each application installation receives a unique device identity.

Fields:

```text
id
deviceIdentifier
userId
platform
appVersion
status
lastSeenAt
lastSyncAt
createdAt
revokedAt
```

Statuses:

```text
ACTIVE
REVOKED
BLOCKED
```

A revoked device cannot synchronize new operations.

---

# 33. AuditEvent

Every important state transition must generate an audit event.

Fields:

```text
id
actorUserId
deviceId
action
entityType
entityId

beforeSnapshot
afterSnapshot

operationId
serverTimestamp
deviceTimestamp

reason
```

Examples:

```text
USAGE_RECORDED
USAGE_VERIFIED
USAGE_CORRECTED
RUNNING_BILL_CREATED
PAYMENT_RECORDED
PAYMENT_REVERSED
BILL_VOIDED
TARIFF_CHANGED
ALLOCATION_APPROVED
BENEFICIARY_DEACTIVATED
DEVICE_REVOKED
```

Audit events are append-only.

---

# 34. Document

Documents may include:

- receipts
- supporting land documents
- payment references
- reports
- imported files

Document metadata must identify:

```text
owner entity
document type
createdBy
createdAt
checksum
```

Financial documents must remain linked to their originating transaction.

---

# 35. Legacy Running Bills

Existing V1 running bills are historical records.

They must retain:

```text
isLegacy = true
legacyClassification = LEGACY_VALID_FINANCIAL_DATA
```

Recommended additional metadata:

```text
legacySource
legacyMigrationId
legacyMigratedAt
legacyOriginalAmount
legacyOriginalTariff
legacyOriginalPeriod
```

Legacy records must never be silently recalculated using the new actual-usage model.

They remain historical truth.

---

# 36. Legacy Isolation Rule

Old records must not accidentally interfere with new billing logic.

For example:

```text
Legacy October bill
+
New October V2 usage
```

must not cause an unintended uniqueness conflict unless the business migration explicitly says that the legacy record represents the same authoritative billing obligation.

Legacy migration rules must be explicit.

---

# 37. Deletion Policy

Hard deletion is prohibited for:

```text
Payments
Bills
Audit events
Usage records that drove financial records
Financial ledger entries
Approved allocations
Historical infrastructure records
```

Use:

```text
INACTIVE
ARCHIVED
VOIDED
REVERSED
```

depending on the entity.

---

# 38. Beneficiary Account vs Beneficiary Record

These are separate concepts.

A beneficiary can be:

```text
beneficiaryStatus = ACTIVE
accountStatus = DISABLED
```

This means the person remains a valid historical/business beneficiary but cannot access the self-service portal.

---

# 39. Offline Ownership Principle

An offline device may create a local operation but does not create globally authoritative truth.

Example:

```text
OFFLINE

Agent records:
42,500 L
```

Local:

```text
WaterUsageRecord
status = PENDING_SYNC
```

After server acceptance:

```text
status = VERIFIED / authoritative state
```

depending on the workflow.

---

# 40. Conflict Principle

When two users modify the same shared entity:

```text
SERVER VERSION WINS
```

but the losing operation must not disappear.

It becomes:

```text
CONFLICT
```

with:

- original operation
- current server state
- attempted change
- actor
- device
- timestamps

Financial records must never use silent last-write-wins.

---

# 41. Payment Conflict Principle

Payments are special.

The server must evaluate every payment against the **current authoritative bill balance**.

Example:

```text
Bill = ₹10,000

Agent A offline:
₹7,000

Agent B online:
₹6,000
```

When A synchronizes:

```text
Current server pending = ₹4,000
Requested = ₹7,000
```

The server must not silently accept the overpayment.

The operation becomes:

```text
CONFLICT / REJECTED_OVERPAYMENT
```

and requires defined resolution.

---

# 42. Usage Conflict Principle

For V1:

```text
ONE ALLOTMENT
+
ONE BILLING PERIOD
+
ONE AUTHORITATIVE USAGE RECORD
```

If two agents attempt to record usage:

```text
First accepted authoritative record
Second operation → conflict
```

The second agent must not overwrite the first.

---

# 43. Tariff Authority

Tariff changes are administrative master-data operations.

They should be:

```text
server-authoritative
versioned
audited
```

An offline device must not invent a new tariff.

Existing bills use their stored tariff snapshot.

Future periods use the applicable tariff according to the effective-date rules.

---

# 44. Approved Allocation Authority

Approved allocation changes are administrative operations.

The authoritative value is:

```text
approvedLitres
```

A device should not silently modify it while offline.

Historical allocation snapshots must remain attached to historical usage/billing decisions.

---

# 45. Billing Authority

The official RunningBill is server-authoritative.

The server determines:

```text
billing period
usage validity
tariff
amount
payment balance
bill status
```

A client may display a calculation preview, but the server calculation is authoritative for the official financial record.

---

# 46. Recommended Entity Ownership Matrix

| Entity | Server Authority | Offline Create | Offline Edit | Financial |
|---|---:|---:|---:|---:|
| District | Yes | No | No | No |
| Panchayat | Yes | No | No | No |
| Village | Yes | No | No | No |
| Project Scheme | Yes | No | No | No |
| Beneficiary | Yes | Yes* | Limited | No |
| Land Holding | Yes | Yes* | Limited | Indirect |
| Survey Parcel | Yes | Yes* | Limited | Indirect |
| Water Allotment | Yes | Draft only* | Restricted | Yes |
| Infrastructure | Yes | Limited | Restricted | Yes |
| Billing Period | Yes | No | No | Yes |
| Water Usage | Yes | Yes | Controlled | Indirect |
| Tariff | Yes | No | No | Yes |
| Running Bill | Yes | No** | No | Yes |
| Payment | Yes | Pending operation | No | Yes |
| Payment Ledger | Yes | Pending operation | No | Yes |
| Audit Event | Yes | Local pending audit | No | Yes |
| User | Yes | No | No | Security |
| Role | Yes | No | No | Security |
| Device | Yes | Local identity | Limited | Security |

`*` Subject to the offline/online contract.

`**` A device may prepare a local billing-related operation if explicitly allowed, but the official bill remains server-authoritative.

---

# 47. V2 Core Domain Invariants

The following must be encoded in service-level validation and, where practical, database constraints.

### Identity

```text
Every entity has immutable unique ID.
```

### Land

```text
Active parcel area total
≈
declared holding area
```

### Allocation

```text
calculatedLitres
=
applicable litres/acre × eligible acres
```

### Running usage

```text
actualUsageLitres >= 0
```

### Meter

```text
currentMeter >= previousMeter
```

### Running bill

```text
verified usage required
```

### Running bill calculation

```text
amountDue
=
actualUsage × runningRate
```

### Bill uniqueness

```text
one active bill / allotment / billing period
```

### Payment

```text
payment > 0
```

### Payment balance

```text
validPayments <= amountDue
```

### Pending

```text
pending = amountDue - validPayments
```

### Historical rates

```text
existing bill snapshots never change
```

### Financial deletion

```text
financial records are never hard-deleted
```

### Audit

```text
financial state transitions are auditable
```

---

# 48. Domain Events

The domain should expose meaningful events.

Examples:

```text
BeneficiaryCreated
BeneficiaryDeactivated

LandHoldingCreated
LandHoldingDeactivated

AllotmentSubmitted
AllotmentApproved
AllotmentCancelled

InfrastructureCommissioned
InfrastructureSuspended

BillingPeriodOpened
BillingPeriodClosed

WaterUsageRecorded
WaterUsageVerified
WaterUsageCorrected
WaterUsageVoided

RunningBillCreated
RunningBillVoided

PaymentRecorded
PaymentReversed
PaymentVoided

TariffCreated
TariffActivated
TariffRetired

DeviceRegistered
DeviceRevoked
```

These events become useful for:

- audit
- synchronization
- notifications
- reporting
- diagnostics

---

# 49. What This Contract Explicitly Prohibits

The following patterns must not be introduced:

```text
Approved allocation × running tariff
```

for running billing.

```text
Overlapping running tariffs added together
```

```text
Payment deletion
```

```text
Bill deletion
```

```text
Silent financial overwrites
```

```text
Offline device overwriting server state
```

```text
Last-write-wins for financial records
```

```text
Duplicate payment acceptance
```

```text
Duplicate usage records for the same allotment + period
```

```text
Different billing formulas in online and offline clients
```

```text
Development tariff entering running billing
```

```text
Changing a tariff and rewriting historical bills
```

```text
Generating a bill without verified usage
```

```text
Hard deletion of historical business records
```

```text
Client-side-only authorization
```

---

# 50. Canonical Running Charges Model

The complete authoritative flow is:

```text
Commissioned Infrastructure
          |
          v
Eligible Billing Period
          |
          v
Field Collection Visit
          |
          v
Actual Water Usage
          |
          v
Usage Verification
          |
          +------> Compare against Approved Allocation
          |             |
          |             +--> Normal
          |             |
          |             +--> OVER_ALLOCATION exception
          |
          v
Resolve RUNNING tariff
          |
          v
Snapshot tariff + usage
          |
          v
Running Bill
          |
          v
Payment
          |
          v
Payment Ledger
          |
          v
Audit
```

The critical formula is:

```text
                  ACTUAL USAGE
                       ×
                 RUNNING RATE
                       =
                  AMOUNT DUE
```

Not:

```text
Approved Allocation × Running Rate
```

---

# 51. Canonical Financial Truth

For every RunningBill:

```text
                 amountDue
                     |
          +----------+----------+
          |                     |
      valid paid             pending
          |                     |
          v                     v
 SUM(valid payments)    amountDue - paid
```

Therefore:

```text
amountDue
=
paid
+
pending
```

and:

```text
paid
=
SUM(valid payment transactions)
```

This reconciliation must always hold.

---

# 52. Implementation Gate

The online/offline implementation must not begin until this document is accepted as the domain baseline.

After approval, the implementation sequence is:

```text
1. Domain Contract          ← THIS DOCUMENT
2. Offline/Online Contract
3. Sync Contract
4. Security Contract
5. Server/PostgreSQL design
6. Client SQLite design
7. Migration strategy
8. Implementation
9. Distributed failure testing
10. Production hardening
```

Any implementation decision that contradicts this document must be explicitly reviewed and documented rather than silently introduced.

---

# 53. Final Domain Principle

WaterGrid V2 must preserve one fundamental distinction:

```text
BUSINESS EVENT
      ↓
DOMAIN STATE
      ↓
FINANCIAL CONSEQUENCE
```

For running charges:

```text
Field records water usage
          ↓
Usage is verified
          ↓
Server resolves applicable tariff
          ↓
Running bill is created
          ↓
Payment is recorded
          ↓
Ledger reconciles
```

The system must never reverse this relationship by inventing usage or financial records merely because a billing screen was opened, a timer fired, a device reconnected, or an allocation exists.

**Actual operational events drive financial records. Financial records are immutable, auditable, transactionally consistent, and server-authoritative.**
