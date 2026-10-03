# WATERGRID V2 — SECURITY CONTRACT

**Document ID:** `WATERGRID-V2-SECURITY-CONTRACT`  
**Version:** `1.0`  
**Status:** Architectural Baseline — Draft for Implementation Review  
**Depends On:**
- `WATERGRID-V2-DOMAIN-CONTRACT`
- `WATERGRID-V2-OFFLINE-ONLINE-CONTRACT`
- `WATERGRID-V2-SYNC-CONTRACT`

**Scope:** Authentication, authorization, device security, offline security, local data protection, API security, financial authorization, audit security, and security failure handling for WaterGrid V2.

---

# 1. Purpose

WaterGrid V2 is a multi-user, multi-device financial and operational system.

It must protect:

- beneficiary information
- land information
- water allocations
- infrastructure records
- water-usage records
- bills
- payments
- financial ledgers
- user accounts
- authentication credentials
- offline local databases
- synchronization operations
- audit records
- administrative functions

The security architecture must assume:

> Devices can be lost, stolen, compromised, offline, outdated, or temporarily out of synchronization.

Therefore:

```text
CLIENT IS NOT TRUSTED
SERVER IS AUTHORITATIVE
FINANCIAL ACTIONS ARE SERVER-VALIDATED
OFFLINE CAPABILITY IS CONTROLLED
```

---

# 2. Security Principles

WaterGrid V2 follows these principles:

1. **Least privilege**
2. **Server-side authorization**
3. **Deny by default**
4. **No plaintext passwords**
5. **No secrets embedded in Electron**
6. **Short-lived access credentials**
7. **Controlled refresh/session mechanism**
8. **Device identity**
9. **Offline capability with bounded trust**
10. **Atomic financial operations**
11. **Immutable financial history**
12. **Append-only audit**
13. **Explicit device revocation**
14. **Secure local storage**
15. **No trust based solely on client-supplied role/device/user IDs**
16. **Security events are auditable**
17. **Sensitive operations require stronger authorization**
18. **Compromise of one device must not compromise the server**

---

# 3. Threat Model

WaterGrid must explicitly consider:

```text
T1  Stolen laptop
T2  Lost laptop
T3  Compromised local user account
T4  Malicious/modified Electron client
T5  Tampered API request
T6  Replay attack
T7  Duplicate payment request
T8  Offline device used for extended period
T9  Revoked user/device reconnecting
T10 Stolen refresh credential
T11 Local SQLite extraction
T12 Malicious insider
T13 Concurrent agents
T14 Stale offline data
T15 Clock manipulation
T16 Server/API abuse
T17 Brute-force login
T18 Session theft
T19 Unauthorized privilege escalation
T20 Audit tampering
T21 Backup theft
T22 Application rollback to vulnerable version
T23 Sync protocol manipulation
T24 Compromised administrative account
```

The architecture must reduce impact even when individual controls fail.

---

# 4. Trust Boundaries

## 4.1 Client

The Electron application is **untrusted from the server's perspective**.

The server must assume that a determined attacker can modify client-side JavaScript or invoke API requests manually.

Therefore:

```text
Frontend validation
≠
Security authorization
```

---

## 4.2 Local Database

Local SQLite is sensitive but not authoritative.

It may contain:

- cached beneficiary information
- land data
- bills
- payment history
- pending operations
- offline payment records
- authentication/session metadata

It must be protected appropriately.

---

## 4.3 Network

All production server communication must use:

```text
HTTPS/TLS
```

No plaintext financial/API communication.

---

## 4.4 Server

The server is the trust boundary for:

- identity
- authorization
- financial state
- synchronization
- roles
- tariffs
- official bills
- official payments
- audit history

---

# 5. Identity Model

WaterGrid separates:

```text
User Identity
Device Identity
Session Identity
Operation Identity
```

They are not interchangeable.

### User

Who is performing the action.

### Device

Which installation initiated the operation.

### Session

Which authenticated login context is being used.

### Operation

Which specific business action is being submitted.

Example:

```text
User A
   |
Device X
   |
Session S
   |
Operation O
   |
Payment P
```

---

# 6. User Accounts

Recommended fields:

```text
id
username
fullName
phone
email
passwordHash
status
failedLoginCount
lockedUntil
lastLoginAt
createdAt
updatedAt
```

Status:

```text
ACTIVE
LOCKED
DISABLED
ARCHIVED
```

Disabled users cannot authenticate.

Archived users cannot authenticate.

---

# 7. Password Storage

Passwords must never be stored as:

```text
plaintext
encrypted reversible password
```

Use a modern password hashing algorithm such as:

```text
Argon2id
```

with an appropriate memory/time configuration selected during security implementation and load testing.

Password hashes must be stored only on the server.

The client must never receive:

```text
password hash
```

---

# 8. Password Requirements

Password policy should enforce a reasonable minimum strength.

Avoid relying only on arbitrary complexity rules.

At minimum:

- sufficient length
- common-password rejection
- breached-password checks where feasible
- no username/phone reuse
- password confirmation during creation/change

The exact policy should be configurable without weakening server security.

---

# 9. Login

Online login:

```text
Username / identifier
        +
Password
        ↓
HTTPS
        ↓
Server
        ↓
Credential verification
        ↓
Account status check
        ↓
Device status check
        ↓
Session creation
```

Failed authentication must not reveal whether:

```text
username exists
```

versus:

```text
password is wrong
```

Use a generic authentication failure response.

---

# 10. Brute-Force Protection

The server must rate-limit authentication attempts.

Controls may include:

```text
per-account throttling
per-device throttling
per-IP throttling
progressive delays
temporary account lock
security logging
```

Do not permanently lock accounts solely because an attacker can repeatedly submit guesses.

The exact thresholds should be configured and monitored.

---

# 11. Session Architecture

The recommended architecture is:

```text
Short-lived access token
        +
longer-lived refresh credential
```

Access token:

```text
short lifetime
```

Refresh credential:

```text
longer lifetime
rotated
revocable
device-bound where practical
```

Exact durations should be selected based on operational requirements and risk.

---

# 12. Access Token

Access tokens should contain only the claims necessary for authorization.

For example:

```text
sub
sessionId
deviceId
role/version metadata where required
issuedAt
expiresAt
issuer
audience
```

Never place sensitive personal or financial information inside tokens.

The server must validate:

```text
signature
issuer
audience
expiry
session/device status
```

---

# 13. Refresh Credential

Refresh credentials must:

- be stored securely
- be revocable
- rotate on refresh where practical
- be associated with a session/device
- not be exposed to renderer JavaScript unnecessarily
- not be logged

If refresh-token reuse is detected, the relevant session/device should be treated as potentially compromised and invalidated according to policy.

---

# 14. Electron Credential Storage

The renderer must never store sensitive authentication credentials in:

```text
localStorage
sessionStorage
IndexedDB
plain JSON
```

where avoidable.

Use:

```text
OS-protected credential/key storage
```

for sensitive secrets.

On supported platforms:

```text
Windows Credential Manager / DPAPI-backed storage
macOS Keychain
```

through a controlled Electron main/preload mechanism.

The exact implementation must avoid exposing raw secrets to arbitrary renderer code.

---

# 15. Electron Security Baseline

Production Electron must use:

```text
contextIsolation = true
nodeIntegration = false
sandbox = true where compatible
```

and a tightly controlled preload bridge.

The renderer must not receive unrestricted:

```text
Node.js
filesystem
child_process
shell
database
```

access.

---

# 16. Content Security Policy

The production renderer must use a restrictive Content Security Policy.

Avoid unrestricted:

```text
unsafe-eval
*
```

where possible.

External script/resource origins must be explicitly controlled.

Any CSP exception must have a documented reason.

---

# 17. IPC Security

Electron IPC endpoints must:

- expose only required operations
- validate arguments
- validate caller context where practical
- never accept arbitrary filesystem paths for sensitive operations without validation
- never expose raw database connections
- never expose server credentials

The preload bridge should expose typed, narrow APIs.

---

# 18. Server-Side Authorization

Every protected API operation must enforce authorization on the server.

The server must derive identity from:

```text
authenticated session
```

not from:

```text
request.body.userId
request.body.role
```

A client cannot become ADMIN by sending:

```text
role: "ADMIN"
```

---

# 19. Role-Based Access Control

Initial roles:

```text
ADMIN
FIELD_OFFICER
COLLECTION_AGENT
ACCOUNTS
VIEWER
BENEFICIARY
```

Authorization is defined by permissions, not by UI visibility.

---

# 20. Permission Model

Recommended permission style:

```text
BENEFICIARY_READ
BENEFICIARY_CREATE
BENEFICIARY_UPDATE

LAND_READ
LAND_CREATE
LAND_UPDATE

ALLOTMENT_READ
ALLOTMENT_CREATE
ALLOTMENT_APPROVE

USAGE_READ
USAGE_RECORD
USAGE_VERIFY
USAGE_CORRECT

BILL_READ
BILL_CREATE
BILL_VOID

PAYMENT_READ
PAYMENT_RECORD
PAYMENT_REVERSE

TARIFF_READ
TARIFF_MANAGE

USER_MANAGE
ROLE_MANAGE
DEVICE_MANAGE

AUDIT_READ
REPORT_READ
```

This is preferable to hardcoding dozens of checks such as:

```text
if role === ADMIN
```

throughout the application.

---

# 21. Least Privilege

Each role receives only required permissions.

Example:

### COLLECTION_AGENT

May:

- view assigned beneficiaries
- record usage
- record authorized collection
- view relevant bills
- view own operational history

May not:

- change tariff
- approve allocation
- change roles
- reverse payments
- manage devices
- close billing periods

---

# 22. Accounts Role

Accounts may:

- view financial records
- record authorized payments
- issue receipts
- process financial reconciliation
- handle payment corrections according to policy

Accounts should not automatically gain:

- role management
- tariff administration
- beneficiary identity administration

unless explicitly granted.

---

# 23. Admin Role

Admin can perform privileged management operations.

However:

> **ADMIN is still subject to audit and transaction controls.**

Admin access must not bypass:

- financial atomicity
- audit
- idempotency
- database integrity
- historical immutability

---

# 24. Beneficiary Access Isolation

A beneficiary may access only their own records.

The server must enforce ownership.

A request such as:

```text
GET /beneficiaries/another-id
```

must not succeed merely because the beneficiary changes an ID in the URL.

Authorization must verify:

```text
authenticated beneficiary
=
requested beneficiary
```

---

# 25. Field-Agent Scope

If field agents are assigned to specific geographic areas or beneficiaries, authorization must be server-enforced.

Client-side filtering is not sufficient.

Example:

```text
Agent A assigned Panchayat X
```

Agent A must not be able to submit:

```text
Panchayat Y
```

by manually modifying an API request.

---

# 26. Object-Level Authorization

Every API operation must verify access to the specific object.

This protects against:

```text
IDOR
(Insecure Direct Object Reference)
```

Examples:

```text
billId
beneficiaryId
paymentId
usageId
landHoldingId
```

A valid login does not automatically grant access to every record.

---

# 27. Financial Authorization

Payment operations require:

```text
authenticated user
+
payment permission
+
bill access
+
valid bill state
+
current balance validation
+
server transaction
```

Client UI buttons are not security controls.

---

# 28. Payment Amount Trust

The server must never trust:

```text
amountPaid
pendingAmount
billBalance
```

sent by the client.

The server calculates current balance from authoritative records.

Example:

```text
Client says:
pending = ₹10,000

Server calculates:
pending = ₹4,000
```

Server value wins.

---

# 29. Payment Atomicity

Every official payment must execute:

```text
BEGIN TRANSACTION

authorize
validate bill
check idempotency
calculate balance
validate amount
create payment
update bill
create ledger entry
create audit event
store idempotency result

COMMIT
```

Failure:

```text
ROLLBACK
```

No partial payment state is allowed.

---

# 30. Offline Payment Authorization

Offline payment capture is a controlled capability.

The device may locally record:

```text
PENDING_SYNC
```

but it cannot independently create authoritative financial truth.

When synchronized:

```text
server authorization
+
server balance check
+
server idempotency
+
server transaction
```

are mandatory.

---

# 31. Offline Permission Lifetime

Offline permissions must not live forever.

A device should periodically obtain updated authorization state.

If the user's role changes:

```text
Server role:
COLLECTION_AGENT → VIEWER
```

the next synchronization must update the device.

Sensitive offline capabilities may be restricted after authorization freshness expires.

---

# 32. Offline Session

Offline access should use a controlled cached session rather than storing the password.

The local session should include:

```text
user identity
device identity
permission snapshot/version
session metadata
offline expiry/policy
```

The exact offline duration must be defined according to operational requirements.

---

# 33. Offline Authentication Failure

If offline session authorization is no longer valid:

```text
Local unsynchronized data
        ↓
must remain preserved
```

but:

```text
new privileged offline operations
```

may be blocked.

The application must never delete pending business data merely because authentication has expired.

---

# 34. Device Registration

On first online login:

```text
User authenticates
        ↓
Device identity generated
        ↓
Server registers device
        ↓
Device receives authorized session
```

The device should have:

```text
deviceId
deviceStatus
registeredAt
lastSeenAt
appVersion
platform
```

---

# 35. Device Trust

Device status:

```text
ACTIVE
REVOKED
BLOCKED
```

A revoked device:

```text
cannot synchronize
cannot obtain new server authorization
```

The server must enforce this.

---

# 36. Lost/Stolen Device

Admin workflow:

```text
Admin
 ↓
Device Management
 ↓
Select device
 ↓
REVOKE
```

At next connection:

```text
Device
 ↓
Server
 ↓
REVOKED
 ↓
session invalidated
sync blocked
```

The server must not trust a revoked device even if its previous access token has not expired.

---

# 37. User Logout

Logout should:

- invalidate/revoke the server session as appropriate
- remove local access credentials
- clear sensitive transient state
- preserve business data according to device policy
- preserve unsynchronized operations if recovery policy permits

Logout must not silently delete pending financial operations.

---

# 38. Password Change

When password changes:

```text
existing sessions
```

should be invalidated or revalidated according to security policy.

At minimum:

- refresh credentials should be invalidated
- high-risk sessions should require reauthentication
- device/session metadata should update

Pending offline work remains preserved.

---

# 39. Account Disablement

If a user is disabled:

```text
server
 ↓
invalidate active sessions
 ↓
block synchronization
```

The device may retain local pending operations, but they cannot be committed under the disabled account.

Resolution must require authorized reauthentication/reassignment.

---

# 40. Role Change

Example:

```text
Agent
→
Viewer
```

The next authenticated synchronization must receive updated permissions.

The device must not continue using old privileged permissions indefinitely.

---

# 41. Privilege Changes While Offline

If a user is offline and their server role changes:

```text
local permission snapshot
```

may temporarily remain until the security policy's offline authorization window expires.

The device must not be allowed unlimited offline privilege after its authorization becomes stale.

High-risk operations should require online confirmation.

---

# 42. Local SQLite Protection

The local database may contain sensitive data.

Recommended:

```text
encrypted SQLite
```

or an equivalent database-encryption approach.

Encryption keys must be protected using the operating system's secure credential/key storage where possible.

Do not use:

```text
hardcoded encryption key
key stored next to database
key stored in source code
key stored in plaintext config
```

---

# 43. Local File Protection

Sensitive local directories should have restricted permissions.

Example conceptual structure:

```text
WaterGrid/
├── database/
├── documents/
├── receipts/
├── backups/
├── logs/
└── config/
```

Sensitive contents must not be placed inside publicly shared directories.

---

# 44. Backup Security

WaterGrid backups may contain:

- personal information
- land information
- payment information
- local synchronization state

Therefore backups must be protected.

Recommended:

```text
encrypted backup
integrity checksum
version metadata
creation timestamp
device/source metadata
```

Do not store backup encryption passwords in the backup itself.

---

# 45. Backup Restore Security

Restoring a backup must not automatically:

```text
trust old sessions
trust old tokens
trust revoked devices
```

Authentication/session secrets should be revalidated or invalidated according to policy.

Pending operation IDs must be preserved so server idempotency can prevent duplicate financial effects.

---

# 46. Local Logs

Logs must not contain:

```text
passwords
access tokens
refresh tokens
encryption keys
full payment credentials
sensitive personal information unnecessarily
```

Use:

```text
operationId
requestId
deviceId
```

for correlation.

Sensitive values should be redacted.

---

# 47. Audit Log Security

Audit events are security-sensitive.

Users must not be able to edit or delete their own audit history.

Audit should be:

```text
append-only
server-authoritative
tamper-resistant
access-controlled
```

---

# 48. Audit Event Requirements

For sensitive operations record:

```text
actor
device
operationId
entity
entityId
action
timestamp
result
reason where applicable
```

For financial changes:

```text
before state
after state
```

or a privacy-safe structured representation sufficient for forensic reconstruction.

---

# 49. Audit Examples

```text
LOGIN_SUCCESS
LOGIN_FAILURE
SESSION_CREATED
SESSION_REVOKED

USAGE_RECORDED
USAGE_VERIFIED
USAGE_CORRECTED

RUNNING_BILL_CREATED
RUNNING_BILL_VOIDED

PAYMENT_RECORDED
PAYMENT_REVERSED
PAYMENT_VOIDED

ALLOTMENT_APPROVED
TARIFF_CHANGED

DEVICE_REGISTERED
DEVICE_REVOKED

ROLE_CHANGED
USER_DISABLED
```

---

# 50. Security Event vs Business Audit

Keep distinct concepts where useful:

```text
SecurityEvent
```

for:

- login failures
- token abuse
- device revocation
- privilege changes

and:

```text
BusinessAuditEvent
```

for:

- payments
- bills
- usage
- allocations
- land changes

They may share infrastructure but should remain semantically distinguishable.

---

# 51. API Security

All APIs must enforce:

```text
authentication
authorization
input validation
rate limiting where appropriate
request size limits
safe error handling
audit for sensitive operations
```

No endpoint should rely on frontend route protection.

---

# 52. API Input Validation

Validate:

- types
- ranges
- enums
- string lengths
- IDs
- decimal precision
- dates
- relationships

Example:

```text
payment.amount <= 0
```

must be rejected.

But DTO validation alone is insufficient.

Service/domain validation must repeat critical financial rules.

---

# 53. API Error Handling

Do not return internal errors such as:

```text
Prisma stack trace
SQL query
filesystem path
JWT internals
database connection string
```

to clients.

Return safe machine-readable errors.

Detailed diagnostics belong in protected server logs.

---

# 54. Rate Limiting

Rate-limit sensitive endpoints:

```text
login
refresh
password reset
payment submission
sync endpoints
device registration
administrative APIs
```

The exact limits should be load-tested.

Do not choose values arbitrarily and never revisit them.

---

# 55. Sync Endpoint Security

Sync endpoints must verify:

```text
authenticated session
device status
device ownership
operation actor
operation authorization
operation protocol version
payload schema
operation integrity
```

A client cannot submit:

```text
deviceId = another-device
actorUserId = admin
```

and gain that identity.

---

# 56. Replay Protection

Replay attacks are controlled through:

```text
operationId
idempotency records
session validation
timestamps where appropriate
device identity
```

For state-changing operations:

```text
same operation
→ same result
```

not:

```text
same request
→ repeated financial effect
```

---

# 57. Request Correlation

Every request should have:

```text
requestId
```

Every synchronization operation has:

```text
operationId
```

Every sync cycle has:

```text
syncSessionId
```

This provides:

```text
request
→ operation
→ transaction
→ audit
```

traceability.

---

# 58. Sensitive Administrative Operations

Require stronger controls for:

- tariff changes
- role changes
- device revocation
- payment reversal
- bill voiding
- allocation approval
- billing-period closure
- destructive master-data changes

Possible controls:

```text
recent authentication
step-up authentication
second authorization
```

depending on operational requirements.

---

# 59. Payment Reversal

Payment reversal is more sensitive than payment creation.

It should require:

```text
authorized role
valid original payment
reason
server online
transaction
audit
```

Offline reversal should not be permitted in V1/V2 unless a separate secure protocol is explicitly designed.

---

# 60. Bill Void

Bill voiding must require:

```text
authorized permission
reason
server-side state validation
audit
transaction
```

A voided bill remains historical.

---

# 61. Tariff Management

Tariff creation/activation must require:

```text
authorized role
online server
effective dates
non-overlap validation
audit
```

The system must reject overlapping active running tariffs if the business model expects one deterministic running rate.

The running billing engine must never add overlapping tariffs together.

---

# 62. Allocation Approval

Approval must require:

```text
authorized role
server online
current record version
land/allocation validation
audit
```

Approved allocation is authoritative.

---

# 63. Billing Period Closure

Closing a billing period is a high-impact operation.

It must be:

```text
online
authorized
audited
transactional
```

The server should verify outstanding workflow conditions before closure.

---

# 64. Multi-Agent Security

Multiple agents must be treated as concurrent actors.

The server must enforce:

```text
object-level authorization
version checks
database constraints
financial transactions
idempotency
audit
```

Never assume:

```text
two agents will not touch the same record.
```

The architecture must assume they will.

---

# 65. Collection Agent Payment Scenario

Agent A:

```text
authorized collection agent
```

records:

```text
₹5,000
```

The server verifies:

```text
agent active
device active
permission valid
bill accessible
amount valid
balance available
operation not already processed
```

Only then is the payment committed.

---

# 66. Agent Cannot Self-Elevate

Changing request:

```text
role = ADMIN
```

must have no effect.

Role comes from:

```text
authenticated server-side identity
```

and server-side permission mapping.

---

# 67. Agent Cannot Change Payment Owner

The server must determine the payment's beneficiary/bill relationship from the authoritative bill.

Do not trust a client request such as:

```text
beneficiaryId = X
billId = Y
```

without checking:

```text
bill Y belongs to beneficiary X
```

and the agent has access.

---

# 68. Agent Cannot Forge Server Confirmation

A client must never be able to locally set:

```text
paymentStatus = CONFIRMED
```

and synchronize that as authoritative.

The server determines official state.

---

# 69. Offline Receipt Security

Offline receipts should clearly state:

```text
OFFLINE
PENDING SERVER CONFIRMATION
```

They should include a locally unique reference.

After server acceptance, the official receipt can receive a server-authoritative receipt number where required.

Do not make a local receipt look identical to a confirmed server-issued receipt if that could mislead users.

---

# 70. Financial Reference Numbers

Server-issued financial identifiers such as:

```text
payment number
receipt number
bill number
```

should be generated by the authoritative server or by a carefully designed conflict-free mechanism.

Do not assume independent devices can safely generate sequential financial numbers offline.

---

# 71. Local Temporary References

Offline operations may use:

```text
local reference
```

such as:

```text
OFF-A7F2...
```

After synchronization, the server may assign the official:

```text
PAY-2026-000123
```

Both can be retained for traceability.

---

# 72. Clock Security

Client time is not authoritative.

The server records:

```text
serverReceivedAt
serverCommittedAt
```

and retains:

```text
clientCreatedAt
```

for audit.

Clock rollback should be detected.

Suspicious time changes should be logged.

---

# 73. Security and Offline Time

If the offline authentication window depends on time, the application must protect against obvious clock rollback.

Maintain:

```text
lastKnownServerTime
lastKnownMonotonicReference
lastSyncTime
```

A large backward jump should trigger:

```text
CLOCK_ANOMALY
```

and may restrict sensitive offline actions.

---

# 74. No Secrets in Application Bundle

Never embed:

```text
database passwords
server private keys
master API keys
admin passwords
JWT signing secrets
encryption master keys
```

inside:

```text
Electron bundle
Next.js bundle
frontend environment variables
source code
```

Client configuration may contain public values such as:

```text
API base URL
public application identifier
```

but no privileged secret.

---

# 75. Server Secret Management

Server secrets should be stored using an appropriate secret-management mechanism.

Examples:

```text
environment secret store
deployment secret manager
OS secret store
cloud secret manager
```

Never commit secrets to Git.

---

# 76. Database Security

PostgreSQL must use:

```text
separate application database user
least required privileges
TLS where applicable
restricted network access
strong credentials
backup protection
```

The API server should be the primary access layer.

Clients must never connect directly to PostgreSQL.

---

# 77. Local Database Access

The Electron application should access local SQLite through a controlled backend/service layer.

The renderer should not receive arbitrary SQL execution privileges.

Developer SQL tooling, if retained, must be:

```text
development/admin only
explicitly protected
audited
```

and disabled or restricted in normal user builds.

---

# 78. SQL Injection

All server and local database queries must use parameterized ORM/query APIs.

Never construct SQL from untrusted strings.

Developer SQL consoles must be treated as privileged functionality.

---

# 79. File Upload Security

Excel/import/document uploads must validate:

- file type
- size
- structure
- extension
- content
- storage path

Uploaded files must not be executed.

File names must be sanitized.

---

# 80. Path Traversal Protection

Never allow user-controlled filenames to directly define arbitrary filesystem paths.

Reject:

```text
../
..\ 
absolute paths
```

and normalize/validate final storage locations.

---

# 81. Document Access Control

A beneficiary must not access another beneficiary's documents by changing a document ID.

The server must verify:

```text
document owner
requesting identity
permission
```

---

# 82. Backup Access Control

Only authorized users may:

- create server backups
- download backups
- restore backups
- manage backup retention

Restore should be treated as a high-impact administrative action.

---

# 83. Data Minimization

The client should synchronize only data required for its role/work scope.

Do not download:

```text
entire beneficiary database
entire payment history
all administrative records
```

to every field device by default.

Use:

```text
assignment-based synchronization
role-based scope
location scope
time/window scope
```

where practical.

---

# 84. Collection Agent Data Scope

A collection agent should ideally receive only:

```text
assigned beneficiaries
relevant allotments
relevant infrastructure
relevant billing periods
relevant bills
required payment/usage history
```

not the entire organization's data.

---

# 85. Beneficiary Data Scope

A beneficiary receives only:

```text
own profile
own land
own allocation
own infrastructure
own usage
own bills
own payments
own documents
```

---

# 86. Security of Synchronization Data

Sync payloads may contain sensitive information.

Therefore:

```text
TLS
+
authenticated session
+
authorization
+
payload validation
+
audit
```

are required.

Do not assume that synchronization traffic is safe merely because the device was previously registered.

---

# 87. Compromised Client Assumption

An attacker with a modified client may attempt:

```text
fake payment
fake role
fake beneficiary
fake tariff
fake approved amount
fake device
```

The server must treat all client input as untrusted and independently validate it.

---

# 88. Compromised Device Limitation

If a device is compromised:

```text
server secrets must not be exposed
other devices must remain secure
server database must remain secure
roles must remain enforced
financial transactions remain server-validated
```

Device revocation must provide a containment mechanism.

---

# 89. Session Revocation

Server must support revoking:

```text
individual session
all sessions for user
all sessions for device
all sessions globally in emergency
```

Use cases:

```text
stolen device
credential compromise
role change
employee departure
security incident
```

---

# 90. Emergency Lockdown

System should support:

```text
GLOBAL_SYNC_PAUSE
DEVICE_SYNC_PAUSE
USER_LOCK
```

This does not delete local work.

It prevents unsafe synchronization until the incident is resolved.

---

# 91. Security Incident Logging

Log security events such as:

```text
repeated login failures
refresh reuse
invalid token
device revocation
role changes
unauthorized API attempts
idempotency misuse
operation ID reuse
clock anomaly
sync protocol mismatch
suspicious payment attempts
```

Do not log secrets.

---

# 92. Security Monitoring

Monitor:

```text
failed login rate
successful login rate
revoked-device attempts
permission-denied rate
payment rejection rate
duplicate operation attempts
unusual sync volume
large offline backlog
multiple devices per user
unexpected geographic/network patterns where appropriate
```

Monitoring must respect applicable privacy requirements.

---

# 93. Multiple Device Policy

A user may or may not be allowed multiple active devices.

This must be explicit.

Recommended:

```text
ADMIN:
controlled multiple devices

FIELD AGENT:
limited number

BENEFICIARY:
controlled personal devices
```

If a device limit exists, the server enforces it.

---

# 94. Device Transfer

A device should not simply be handed from User A to User B without a controlled process.

Recommended:

```text
logout
device reassignment/re-registration
session invalidation
local sensitive data cleanup
new user authentication
```

Pending operations from the previous user must not be accidentally submitted under the new user.

---

# 95. User Switching

The old V1 "Switch User" behavior should not bypass authentication.

If multiple users use one physical machine:

```text
User A logout
        ↓
User B login
        ↓
new authenticated session
```

Do not simply switch a frontend variable:

```text
currentUser = B
```

---

# 96. Shared Device Consideration

If WaterGrid is used on a shared office machine:

```text
local cached data
```

must be scoped carefully.

A new user should not automatically gain access to another user's sensitive cached data.

The local cache architecture must support appropriate isolation or controlled shared-device policy.

---

# 97. Beneficiary Self-Service Security

Beneficiary portal authentication must enforce:

```text
own beneficiary identity
```

and protect against:

- account enumeration
- OTP abuse
- password brute force
- IDOR
- session theft
- unauthorized bill/payment access

---

# 98. OTP / Recovery

If OTP is introduced:

- OTP must expire quickly
- OTP must be single-use
- attempts must be limited
- OTP must never be logged
- resend must be rate-limited
- recovery must not reveal whether an account exists

The exact provider is outside this document.

---

# 99. Security of Local Pending Payments

Pending offline payments are particularly sensitive.

They must have:

```text
operationId
local payment reference
actor
device
timestamp
bill
amount
payment mode
```

and must be protected from local editing after submission except through an explicit correction workflow.

---

# 100. Offline Tampering

If a user manually edits the SQLite database:

```text
amount = ₹100
```

instead of:

```text
amount = ₹5,000
```

the server must not blindly trust it.

Synchronization should validate:

```text
operation integrity
payload schema
authorization
business rules
```

Where stronger tamper detection is needed, operation records may include cryptographic integrity metadata.

---

# 101. Local Encryption Does Not Replace Server Authorization

Even if SQLite is encrypted:

```text
server authorization remains mandatory
```

Encryption protects data at rest.

It does not establish business authority.

---

# 102. Cryptographic Keys

Keys must have:

```text
generation
storage
rotation
revocation/recovery
```

policies.

Do not invent custom cryptographic algorithms.

Use established platform/library primitives.

---

# 103. TLS Certificate Handling

Do not disable TLS verification to "fix" connectivity.

Prohibited:

```text
rejectUnauthorized = false
```

in production.

Certificate failures should produce a safe connection error.

---

# 104. API Base URL

Production API endpoints must be controlled configuration.

Do not allow arbitrary untrusted URLs to become synchronization endpoints without validation.

Changing server endpoints should be an administrative/deployment-level operation.

---

# 105. Dependency Security

The application must maintain:

```text
dependency lockfiles
regular dependency updates
security scanning
Electron updates
Node runtime updates
Prisma updates
```

Critical security vulnerabilities must be assessed before deployment.

---

# 106. Electron Packaging Security

Production builds should:

- sign applications where feasible
- use trusted build pipeline
- protect release artifacts
- verify version
- prevent unauthorized downgrade where practical

Unsigned or tampered binaries should not be treated as trusted merely because they have the correct application name.

---

# 107. Application Update Security

Updates must be authenticated and integrity-checked.

Never blindly execute an arbitrary downloaded update.

The update mechanism should verify:

```text
source
signature/integrity
version
compatibility
```

before installation.

---

# 108. Database Migration Security

Migrations must:

```text
be versioned
be tested
be transactional where possible
preserve financial data
preserve outbox
preserve audit
```

A failed migration must not leave the database in a silently inconsistent state.

---

# 109. Security During Migration

Before destructive schema migration:

```text
backup
integrity check
migration
verification
```

If verification fails:

```text
stop application
```

rather than continuing with potentially corrupted financial data.

---

# 110. Financial Security Invariants

Security controls must preserve the domain invariants:

```text
amountDue
=
actualUsage × runningRate
```

```text
amountPaid
=
SUM(valid payments)
```

```text
pending
=
amountDue - amountPaid
```

```text
validPayments <= amountDue
```

and:

```text
one active bill per allotment + period
```

Security must never be implemented in a way that bypasses these rules.

---

# 111. Server-Side Financial Authorization Sequence

For a payment:

```text
1. Authenticate
2. Verify session
3. Verify device
4. Verify permission
5. Verify object access
6. Check idempotency
7. Load authoritative bill
8. Check bill state
9. Calculate current balance
10. Validate amount
11. Commit transaction
12. Write audit
13. Return authoritative result
```

No step may be skipped because the client claims the operation was previously validated.

---

# 112. Audit Cannot Be Bypassed

Developer tools, admin APIs, database utilities, and emergency tools must not silently modify financial records without audit.

If a legitimate emergency procedure exists:

```text
explicit command
+
authorized operator
+
reason
+
audit
```

---

# 113. Developer Portal Security

The Developer Portal must be considered privileged.

It should require:

```text
developer/admin permission
```

and should not be exposed to ordinary agents.

Sensitive capabilities:

```text
SQL
database inspection
sync controls
backup restore
device management
cache reset
```

must be restricted.

---

# 114. SQL Console

If a SQL console remains available:

- production access must be heavily restricted
- read-only by default
- write mode explicitly gated
- every write audited
- dangerous commands restricted where practical
- no raw credential exposure

A SQL console must never become a backdoor around application business rules.

---

# 115. Security of Backups and Exports

Excel/PDF exports may contain sensitive information.

Export permissions must be role-controlled.

Exports should not automatically include:

```text
passwords
authentication data
internal IDs unnecessary for the user
```

Where practical, exported financial reports should identify:

```text
generated by
generated at
data period
```

---

# 116. Data Retention

Security does not mean retaining everything forever.

Retention policies must be defined for:

- audit records
- authentication logs
- rejected sync operations
- backups
- documents
- reports
- payment records

Financial/legal retention requirements must take precedence where applicable.

---

# 117. Privacy

Only necessary personal information should be collected and synchronized.

Avoid unnecessary exposure of:

- phone numbers
- email
- addresses
- identity documents
- financial details

to users who do not need them.

---

# 118. Security Testing

Before production, conduct:

### Authentication

```text
AUTH-001 valid login
AUTH-002 wrong password
AUTH-003 brute force
AUTH-004 disabled user
AUTH-005 expired session
AUTH-006 revoked session
AUTH-007 refresh reuse
```

### Authorization

```text
AUTHZ-001 role enforcement
AUTHZ-002 object-level authorization
AUTHZ-003 IDOR
AUTHZ-004 privilege escalation
AUTHZ-005 beneficiary isolation
AUTHZ-006 agent scope
```

### Offline

```text
SEC-OFF-001 offline session
SEC-OFF-002 expired offline authorization
SEC-OFF-003 role changed while offline
SEC-OFF-004 device revoked
SEC-OFF-005 restored device
```

### Financial

```text
SEC-FIN-001 duplicate payment
SEC-FIN-002 tampered amount
SEC-FIN-003 overpayment
SEC-FIN-004 payment replay
SEC-FIN-005 payment reversal authorization
```

### Device

```text
DEV-001 registration
DEV-002 duplicate identity
DEV-003 revoke
DEV-004 stolen device
DEV-005 reassignment
```

### Local security

```text
LOCAL-001 database encryption
LOCAL-002 credential storage
LOCAL-003 log redaction
LOCAL-004 backup protection
LOCAL-005 filesystem permissions
```

---

# 119. Security Chaos Tests

WaterGrid must intentionally simulate:

```text
stolen device
expired token during sync
revoked device during sync
role changed during offline period
duplicate payment request
tampered local database
tampered operation payload
replayed operation
crash after server commit
server unavailable
server restored
clock rollback
old app version
invalid sync protocol
```

Expected behavior must be deterministic.

---

# 120. Critical Security Scenario — Stolen Device

```text
Device stolen
      ↓
Admin revokes device
      ↓
Server marks REVOKED
      ↓
Device reconnects
      ↓
Server rejects authentication/sync
```

Expected:

```text
No new authoritative operations
```

Pending local data is not automatically destroyed.

Recovery follows the defined secure recovery process.

---

# 121. Critical Security Scenario — Role Downgrade

```text
Agent
 ↓
works offline
 ↓
Admin changes role to VIEWER
 ↓
Agent reconnects
```

Expected:

```text
server role wins
old privileged permissions expire
```

Pending operations are evaluated according to their authorization at synchronization.

---

# 122. Critical Security Scenario — Payment Tampering

Local attacker changes:

```text
₹5,000
```

to:

```text
₹500
```

or:

```text
₹50,000
```

Server:

```text
authenticate
authorize
validate payload
validate bill
validate balance
```

Only valid operation is accepted.

---

# 123. Critical Security Scenario — Replay

Attacker captures operation:

```text
PAYMENT ABC
₹5,000
```

and sends it repeatedly.

Server:

```text
operation ABC already processed
```

Expected:

```text
one business effect
```

---

# 124. Critical Security Scenario — Session Theft

If an access credential is stolen:

- access token has limited lifetime
- refresh credential is protected/rotated
- device/session can be revoked
- server validates session state
- sensitive actions require authorization

The attacker must not automatically gain permanent access.

---

# 125. Security vs Offline Availability

WaterGrid must balance:

```text
availability
vs
security
```

Not every operation should remain available offline.

High-risk operations should prefer:

```text
ONLINE ONLY
```

rather than creating a complex and insecure offline protocol.

---

# 126. Security Decision Rule

When evaluating whether an operation should work offline, ask:

```text
Can this operation safely be represented as
a pending local event?

Can the server deterministically validate it later?

Can duplication be prevented?

Can conflict be resolved without guessing?

Can compromise be contained?

Can historical truth be preserved?
```

If the answer is no:

```text
ONLINE ONLY
```

---

# 127. Recommended Offline Capability Matrix

| Operation | Offline | Server Confirmation Required |
|---|---:|---:|
| View cached records | Yes | No |
| Field usage capture | Yes | Yes |
| Field notes | Yes | Yes |
| Payment capture | Controlled | Yes |
| Beneficiary draft | Controlled | Yes |
| Land draft | Controlled | Yes |
| Official bill creation | No | Yes |
| Tariff change | No | Yes |
| Allocation approval | No | Yes |
| Payment reversal | No | Yes |
| User creation | No | Yes |
| Role change | No | Yes |
| Device revoke | No | Yes |
| Billing-period closure | No | Yes |
| Master-data destructive change | No | Yes |

---

# 128. Secure Failure Principle

When uncertain:

```text
DO NOT GUESS
DO NOT SILENTLY ACCEPT
DO NOT SILENTLY DISCARD
```

Instead:

```text
preserve operation
record failure
surface reason
require retry or authorized resolution
```

---

# 129. Security Incident Recovery

If corruption or compromise is suspected:

```text
1. Pause affected synchronization
2. Revoke affected devices/sessions
3. Preserve logs
4. Preserve pending operations
5. Identify affected transactions
6. Verify database integrity
7. Reconcile financial records
8. Restore/recover if required
9. Re-enable devices deliberately
10. Document incident
```

Never simply wipe client databases as the first response because pending financial evidence may be lost.

---

# 130. Production Security Gate

WaterGrid V2 must not be declared production-ready until:

```text
authentication tested
authorization tested
offline session tested
device revocation tested
local database protection tested
backup security tested
sync security tested
payment authorization tested
idempotency tested
audit integrity tested
Electron security tested
dependency vulnerabilities reviewed
TLS verified
secrets reviewed
privileged tools restricted
```

---

# 131. Final Security Architecture

```text
                         WATERGRID SERVER
                    ┌──────────────────────┐
                    │ Authentication       │
                    │ Authorization        │
                    │ PostgreSQL           │
                    │ Financial Engine     │
                    │ Sync Engine          │
                    │ Audit                │
                    │ Device Management    │
                    └──────────┬───────────┘
                               │
                         HTTPS / TLS
                               │
                    ┌──────────┴──────────┐
                    │                     │
                Device A              Device B
                    │                     │
             ┌──────▼──────┐       ┌──────▼──────┐
             │ Electron    │       │ Electron    │
             │ Secure IPC  │       │ Secure IPC  │
             │ Local DB    │       │ Local DB    │
             │ Outbox      │       │ Outbox      │
             └─────────────┘       └─────────────┘
```

Trust model:

```text
Renderer
  ↓ untrusted

Electron main/service
  ↓ controlled

Local DB
  ↓ protected but not authoritative

Server API
  ↓ authenticated + authorized

PostgreSQL
  ↓ authoritative

Financial Ledger
  ↓ immutable/audited
```

---

# 132. Final Security Principles

WaterGrid V2 security is based on:

```text
Never trust the client.
Never trust client-supplied roles.
Never trust client-supplied balances.
Never trust offline confirmation as server confirmation.
Never store passwords in plaintext.
Never embed server secrets in the app.
Never hard-delete financial history.
Never bypass authorization for admin convenience.
Never let retries duplicate financial effects.
Never allow a revoked device to synchronize.
Never let stale data silently overwrite newer server state.
Never allow offline availability to bypass financial controls.
```

And:

```text
Authenticate
      ↓
Authorize
      ↓
Validate
      ↓
Idempotency
      ↓
Transaction
      ↓
Audit
      ↓
Commit
```

---

# 133. Final Implementation Gate

Documents A, B, C, and D now form the architectural baseline for WaterGrid V2.

Implementation must proceed only after these contracts are reviewed together.

The next step after approval is not immediately "rewrite the app."

The implementation should first produce:

```text
1. Current V1 architecture inventory
2. V1 → V2 migration map
3. PostgreSQL server schema
4. Client SQLite schema
5. Auth/session architecture
6. Sync protocol implementation design
7. API contract
8. Migration/data-preservation plan
9. Test strategy
10. Staged implementation plan
```

Only then should production code changes begin.

---

# 134. Final Security Rule

WaterGrid handles money and operational records across multiple independent devices.

Therefore the security model must assume:

```text
the network can fail
the device can fail
the user can make mistakes
the client can be modified
two agents can act simultaneously
credentials can expire
devices can be stolen
requests can be replayed
responses can be lost
databases can be restored
clocks can be wrong
```

The system remains secure when these events occur because:

```text
SERVER AUTHORITY
+
LEAST PRIVILEGE
+
DEVICE TRUST
+
ATOMIC TRANSACTIONS
+
IDEMPOTENCY
+
VERSIONING
+
AUDIT
+
ENCRYPTED LOCAL STORAGE
+
CONTROLLED OFFLINE ACCESS
+
EXPLICIT REVOCATION
+
FAIL-CLOSED SENSITIVE OPERATIONS
```

form the security boundary.

**Security must prevent an individual device failure from becoming a system-wide financial or authorization failure.**
