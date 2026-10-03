# WaterGrid V2 — User, Role, Permission & Audit Management Architecture Audit

**Document Version:** 2.0.0  
**Audit Date:** October 3, 2026  
**Auditor:** Antigravity Autonomous Systems Engineering Team  
**Scope:** Identity and Access Management (IAM), Role-Based Access Control (RBAC), Geographic Access Control, Audit Integrity, Device Security, Offline Actor Continuity, and UI Administration.

---

## 1. Executive Summary & Verdict

This authoritative technical audit evaluates the current state of identity, authentication, authorization, device security, and audit attribution across the WaterGrid application (spanning the Neon PostgreSQL cloud backend, the local SQLite offline engine, NestJS services, Electron host, and Next.js frontend).

### Global Classification: **PARTIAL**

While the foundational building blocks for authentication (bcrypt password hashing, JWT access tokens, rotating refresh tokens, and basic audit logging) exist in the codebase, the system lacks:
1. Granular permission enforcement and permission guards.
2. Server-side geographic access control (enabling potential Insecure Direct Object Reference / IDOR vulnerabilities for field staff).
3. First-login forced password change workflows and user lifecycle states (`LOCKED`, `DISABLED`, `ARCHIVED`).
4. Structured actor identity preservation and verification across the offline-to-online sync pipeline.
5. Administrative user management and user activity inspection interfaces.

---

## 2. Component-by-Component Audit & Evaluation

| Domain | Evaluated Component | Current State Description | Verdict | Gap & Vulnerability Analysis |
| :--- | :--- | :--- | :---: | :--- |
| **Data Model** | `User` Model | `user_id`, `email`, `password_hash`, `full_name`, `role_id`, `is_active`, timestamps. | **PARTIAL** | Missing `phone`, `employee_id`, `username`, `status` (`ACTIVE`, `LOCKED`, `DISABLED`, `ARCHIVED`), `created_by`, `disabled_at`, `disabled_by`, `last_login_at`, and `force_password_change` flag. |
| **Data Model** | `Role` Model | `role_id`, `name`, `description`, `created_at`. Enum: `ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`, `VIEWER`, `BENEFICIARY`. | **PARTIAL** | Missing required `COLLECTION_AGENT` role in Prisma enum and seed tables. Roles are monolithic without relational permissions. |
| **Data Model** | `Permission` & `RolePermission` | No tables exist in Prisma schema for permissions or role-permission mappings. | **FAIL** | System relies strictly on coarsened role checks; impossible to assign fine-grained capabilities (e.g. `PAYMENT_RECORD` vs `PAYMENT_REVERSE`). |
| **Data Model** | Geographic Scope | No scope tables or relations link users to authorized Districts, Blocks, or Panchayats. | **FAIL** | Zero data model support for restricting users to territorial jurisdictions. |
| **Authentication** | Passwords & Hashing | Uses `bcrypt` (10 rounds) for password hashing. | **PASS** | Passwords are never stored in plaintext and password hashes are excluded from JSON serialization in API responses. |
| **Authentication** | JWT Access Tokens | Signed with `JWT_SECRET`, 1-hour expiration. Payload: `sub`, `email`, `role`, `name`, `deviceId`. | **PARTIAL** | Lacks `tokenVersion` or `sessionVersion`; cannot immediately invalidate issued tokens when role changes or account is disabled. |
| **Authentication** | Refresh Tokens | Stored in `refresh_tokens` table, single-use rotation implemented upon renewal. | **PARTIAL** | Rotation works, but refresh does not check whether user status is `DISABLED` or `LOCKED`, nor does it verify if device is revoked. |
| **Authentication** | First Login & Temp Passwords | No flag or workflow for temporary credentials or forced password rotation. | **FAIL** | Admin-created accounts currently have permanent passwords set by the admin, violating separation of duty. |
| **Authorization** | `JwtAuthGuard` & `JwtStrategy` | Strategy validates JWT signature and loads user from database. | **PARTIAL** | Checks only `user.is_active`. Does not check `status`, token revocation list, or forced password reset state. |
| **Authorization** | `RolesGuard` | Checks `@Roles(...)` metadata against `user.role` from request context. | **PARTIAL** | Inspects JWT claim statically. If role is demoted in database, user retains elevated permissions until token expiry. |
| **Authorization** | Permission Guards | No `@RequirePermissions(...)` decorator or `PermissionsGuard`. | **FAIL** | Cannot enforce granular operation privileges at the route level. |
| **Access Control** | Geographic Scope Enforcement | Controllers accept entity IDs and load records without validating user territorial jurisdiction. | **FAIL** | Critical IDOR risk: a `FIELD_OFFICER` assigned to District A can submit, edit, or approve records for District B by supplying the foreign UUID. |
| **Device Security** | `DeviceRegistration` Model | Tracks `device_id`, `device_name`, `app_version`, `is_active`, `revoked_at`. | **PARTIAL** | Missing `user_id` linkage, `platform`, and explicit `status` (`ACTIVE`, `REVOKED`, `BLOCKED`). |
| **Device Security** | Device Revocation Defense | Endpoint `POST /sync/revoke-device` sets `is_active = false`. Sync push checks active state. | **PASS** | Revoked devices are rejected with `403 Forbidden` on sync push. |
| **Credentials** | Electron SafeStorage | IPC channels `app:get-secure-token` and `app:set-secure-token` utilize `electron.safeStorage` DPAPI/Keychain. | **PARTIAL** | Backend/Electron IPC layer is implemented, but frontend `auth-context.tsx` was still invoking direct synchronous `localStorage`. |
| **Offline Identity** | Outbox Actor Attribution | `SyncOutbox` records `client_op_id`, `device_id`, `operation_type`, `payload_json`. | **FAIL** | Missing `actor_user_id` in `SyncOutbox` and `SyncEnvelopeDto`. Central sync push endpoint uses `req.user?.userId` which evaluated to `undefined` due to property mismatch (`user_id`). |
| **Audit Logging** | `AuditLog` Model & Service | `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `reason`, `ip_address`. | **PARTIAL** | Lacks dedicated fields for `actor_role`, `device_id`, `operation_id`, `sync_status`, and `mode` (ONLINE/OFFLINE). |
| **Audit Logging** | Audit Search & Filtering | `AuditService.findAll` has basic filter parameters. | **PARTIAL** | Lacks server-side pagination, user filter, date-range index optimization, and dedicated audit search API endpoint. |
| **Administration** | Admin User Management UI | No `/admin/users` UI pages in frontend. | **FAIL** | Admins currently cannot view, create, edit, lock, or inspect users via the WaterGrid interface. |
| **Administration** | User Activity Timeline | No user activity view in frontend or backend. | **FAIL** | Admins cannot view a unified timeline of actions taken by a specific employee or officer. |

---

## 3. High-Priority Architectural Vulnerabilities & Remediation Plan

### 3.1. Vulnerability 1: Insecure Direct Object Reference (IDOR) via Lack of Geographic Scope
- **Root Cause:** Entities (`Beneficiary`, `LandHolding`, `WaterApplication`, `WaterUsageRecord`, `Payment`) are bound to territorial locations (`district_id`, `block_id`, `panchayat_id`, `village_id`). However, controllers only perform role checks (`@Roles(RoleName.FIELD_OFFICER)`). Any authenticated field officer can query or mutate records from any district across Tamil Nadu.
- **Remediation:** 
  1. Add `UserGeographicScope` model binding a user to one `district_id` and an optional array of `panchayat_ids`.
  2. Implement `GeographicScopeGuard` and a helper service method `assertGeographicAccess(user, entityLocation)` on all entity service mutations and detailed reads.
  3. Ensure server returns `403 Forbidden` if a user attempts to access or mutate an entity outside their assigned district/panchayat.

### 3.2. Vulnerability 2: Stale Role & Disabled Session Exploitation
- **Root Cause:** JWT access tokens have a 1-hour lifespan and encode `user.role`. If an Admin revokes or downgrades an officer's role, the officer can continue performing sensitive actions until the token expires. Furthermore, if a user is `DISABLED`, existing refresh tokens are not systematically revoked.
- **Remediation:**
  1. Add `token_version Int @default(1)` to the `User` model.
  2. Embed `tokenVersion` in the JWT payload.
  3. Validate `tokenVersion` inside `JwtStrategy.validate()`. When an admin disables a user, changes a role, or forces a password reset, increment `token_version` and revoke all active refresh tokens in a single transaction.

### 3.3. Vulnerability 3: Sync Actor Forgery & Unattributed Offline Operations
- **Root Cause:** `SyncEnvelopeDto` did not specify an `actorUserId`, and `sync.controller.ts` had a typo referencing `req.user?.userId` instead of `req.user?.user_id`.
- **Remediation:**
  1. Explicitly attach `actor_user_id` to local SQLite `SyncOutbox`.
  2. In `SyncEnvelopeDto`, include `actorUserId`.
  3. Server-side validation during `processPush`: verify that `envelope.actorUserId` matches an active user with valid credentials, verify the device is linked to or authorized for this user, and ensure the operation is attributed to that exact authenticated server context.

### 3.4. Vulnerability 4: Insecure Administrative Password Provisioning
- **Root Cause:** Currently, an admin creating an account supplies a password directly in `CreateUserDto`, which sets a permanent password.
- **Remediation:**
  1. Implement temporary password provisioning with a cryptographic random one-time password (or admin-specified initial temporary password).
  2. Set `force_password_change = true` and `status = ACTIVE` (or `status = LOCKED` if account needs verification).
  3. In `JwtAuthGuard` or `FirstLoginGuard`, if `force_password_change` is true, restrict API access to only `POST /auth/change-password` and `GET /auth/me`, blocking all operational routes until the user chooses their personal secret password.

---

## 4. Implementation Blueprint

### Phase 1: Database Schema Expansion (PostgreSQL & SQLite)
- Add `COLLECTION_AGENT` to `RoleName`.
- Add `UserStatus` enum: `ACTIVE`, `LOCKED`, `DISABLED`, `ARCHIVED`.
- Extend `User` model: `phone`, `employee_id`, `username`, `status`, `force_password_change`, `token_version`, `created_by`, `disabled_at`, `disabled_by`, `last_login_at`.
- Add `UserGeographicScope` model: `scope_id`, `user_id`, `district_id`, `panchayat_ids` (JSON / array).
- Add `Permission` & `RolePermission` models with comprehensive permission seeds.
- Extend `DeviceRegistration`: `user_id`, `platform`, `status` (`ACTIVE`, `REVOKED`, `BLOCKED`).
- Extend `AuditLog`: `actor_role`, `device_id`, `operation_id`, `sync_status`, `mode`.

### Phase 2: Backend IAM & Authorization Hardening
- Implement `PermissionsGuard` and `@RequirePermissions(...)`.
- Implement `GeographicScopeGuard` and territorial authorization middleware.
- Update `AuthService`:
  - Enforce user status (`LOCKED`, `DISABLED`, `ARCHIVED`).
  - Temporary password generation + `force_password_change`.
  - Token versioning and instant session revocation.
  - Device status verification on login and refresh.
- Expand `UsersService` & `UsersController`:
  - Full CRUD with filters (`role`, `status`, search term).
  - Endpoints: `lock`, `unlock`, `disable`, `reactivate`, `force-password-reset`, `revoke-sessions`, `revoke-devices`, `activity`, `geographic-scope`.
- Harden `SyncService`:
  - Verify actor identity against device registration.
  - Enforce permissions and geographic scope on pushed operations.
  - Write atomic audit logs with actor, role, device, mode, and sync status.

### Phase 3: Frontend User Management & Security Experience
- Create `/admin/users` listing with role/status filters, search, and action triggers.
- Create `/admin/users/new` modal/page with role, district/panchayat selector, and temporary password issuance.
- Create `/admin/users/[id]` with 7 dedicated tabs:
  1. Overview (profile, status, employee info)
  2. Permissions (effective permissions view)
  3. Geographic Scope (assigned district & panchayats)
  4. Devices (registered hardware, revoke/block controls)
  5. Sessions (active refresh tokens, revoke all button)
  6. Activity (chronological action stream)
  7. Audit (raw audit trail)
- First-login forced password change interstitial banner/modal.
- Update `auth-context.tsx` to strictly use `getSecureToken` and `setSecureToken`.

### Phase 4: Automated Verification (USER-001 through USER-030)
- Develop exhaustive E2E and integration test suite covering all 30 specified verification scenarios.
- Verify zero regression across existing offline SQLite workflows and financial balances.

---

## 5. Audit Conclusion

The current WaterGrid V1/V2 baseline provides a reliable foundation, but requires immediate structural hardening in IAM, territorial scoping, and audit attribution to satisfy enterprise-grade public sector deployment standards. Proceed directly with the execution of the implementation blueprint.
