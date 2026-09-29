# Water Management System — Database Architecture & Specification

## 1. Overview & Principles

The database layer is powered by **PostgreSQL 16** and managed using **Prisma ORM**. It is architected around financial immutability, auditability, strict referential integrity, and exact numerical precision.

### Key Database Design Principles:
1. **Never Float**: All financial currency values and volumetric quantities use PostgreSQL `NUMERIC` types:
   - Currency (`amount`, `balance`, `rate_per_litre`): `Decimal @db.Decimal(14, 2)` (supports up to ₹999,999,999,999.99 with exact paisa precision).
   - Land Area (`acres`): `Decimal @db.Decimal(12, 4)` (supports down to 0.0001 acre / 4.356 sq ft accuracy).
   - Water Volume (`litres`): `Decimal @db.Decimal(14, 2)` (supports up to 999 billion litres).
2. **Permanent Entity Identity**: Beneficiaries and core financial entities use UUID primary keys (`gen_random_uuid()`).
3. **Temporal Rate Versioning**: Rate tariff records are immutable once effective. Updates insert a new record with `effective_from` and set `effective_to` on the superseded record.
4. **Historical Snapshotting**: Billing and allotment events snapshot rates and acreage at execution time. Retroactive changes to project settings never alter historical invoices.
5. **Double-Entry Style Auditability**: Payments are immutable. Corrections occur via offsetting reversal transactions (`is_reversal: true`).
6. **Unified Audit Log**: All mutations across tables generate structured entries in `audit_logs` capturing JSON diffs (`old_values`, `new_values`), actor ID, and IP address.

---

## 2. Entity Catalog & Table Schemas

### 2.1 Identity, Access & Administrative Setup

#### `roles`
System access roles enforcing Role-Based Access Control (RBAC).
- `role_id` (`UUID`, PK): Unique identifier.
- `name` (`RoleName`, Unique): `ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`, `VIEWER`.
- `description` (`TEXT`, Nullable): Description of role privileges.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Timestamps.

#### `users`
Authenticated operators of the system.
- `user_id` (`UUID`, PK): Primary key.
- `role_id` (`UUID`, FK -> `roles.role_id`): Assigned role.
- `email` (`VARCHAR(255)`, Unique): User login email.
- `password_hash` (`VARCHAR(255)`): bcrypt salted hash.
- `full_name` (`VARCHAR(255)`): Operator name.
- `phone` (`VARCHAR(32)`, Nullable): Contact phone.
- `is_active` (`BOOLEAN`, Default: `true`): Deactivation flag.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

#### `refresh_tokens`
Cryptographic refresh token store for session rotation.
- `id` (`UUID`, PK): Primary key.
- `user_id` (`UUID`, FK -> `users.user_id`): User owner.
- `token_hash` (`VARCHAR(255)`, Unique): SHA-256 hash of refresh token.
- `revoked` (`BOOLEAN`, Default: `false`): Explicit revocation marker.
- `expires_at` (`TIMESTAMPTZ`): Expiration threshold.
- `created_at` (`TIMESTAMPTZ`).

---

### 2.2 Official Geographic Hierarchy & LGD Master Data

#### `districts`
Authoritative LGD-coded administrative districts.
- `district_id` (`UUID`, PK): Primary key (`gen_random_uuid()`).
- `lgd_district_code` (`INT`, Unique, Nullable): Official Local Government Directory (LGD) district code.
- `name` (`VARCHAR(255)`): District name (e.g., `Coimbatore`, `Kancheepuram`).
- `is_active` (`BOOLEAN`, Default: `true`): Active status flag.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Timestamps.
- *Indexes*: `idx_districts_lgd (lgd_district_code)`, `idx_districts_name (name)`.

#### `blocks`
Dedicated administrative block level between District and Village.
- `block_id` (`UUID`, PK): Primary key (`gen_random_uuid()`).
- `district_id` (`UUID`, FK -> `districts.district_id`, `ON DELETE RESTRICT`): Parent district.
- `lgd_block_code` (`INT`, Unique): Official LGD block identifier.
- `name` (`VARCHAR(255)`): Block name (e.g., `Pollachi North`, `Walajabad`).
- `is_active` (`BOOLEAN`, Default: `true`): Active status flag.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Timestamps.
- *Indexes*: `idx_blocks_lgd (lgd_block_code)`, `idx_blocks_district (district_id)`, `idx_blocks_dist_lgd (district_id, lgd_block_code)`.

#### `villages`
Granular revenue villages mapped to blocks.
- `village_id` (`UUID`, PK): Primary key (`gen_random_uuid()`).
- `block_id` (`UUID`, FK -> `blocks.block_id`, `ON DELETE RESTRICT`): Parent administrative block.
- `panchayat_id` (`UUID`, Nullable, FK -> `panchayats.panchayat_id`): Legacy backward compatibility.
- `lgd_village_code` (`INT`, Unique, Nullable): Official LGD village code (e.g., `223994`).
- `name` (`VARCHAR(255)`): Village name (e.g., `Angambakkam`, `Annamalai`).
- `is_active` (`BOOLEAN`, Default: `true`): Active status flag.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Timestamps.
- *Indexes*: `idx_villages_block (block_id)`, `idx_villages_lgd (lgd_village_code)`, `idx_villages_name (name)`.

#### `location_imports`
Administrative audit and tracking table for Excel master data imports.
- `import_id` (`UUID`, PK): Primary key.
- `file_name` (`VARCHAR(255)`): Uploaded spreadsheet file name.
- `file_hash` (`VARCHAR(64)`): SHA-256 cryptographic checksum of raw file buffer.
- `uploaded_by` (`VARCHAR(255)`): Email of administrator who uploaded the file.
- `uploaded_at` (`TIMESTAMPTZ`, Default: `now()`): Timestamp of upload.
- `total_rows` (`INT`): Total rows in spreadsheet sheet.
- `valid_rows` (`INT`): Number of valid, parsed rows ready for import.
- `invalid_rows` (`INT`): Number of row validation errors detected.
- `districts_created` / `districts_updated` (`INT`, Default: `0`): Districts upsert counts.
- `blocks_created` / `blocks_updated` (`INT`, Default: `0`): Blocks upsert counts.
- `villages_created` / `villages_updated` (`INT`, Default: `0`): Villages upsert counts.
- `status` (`LocationImportStatus`): `UPLOADED`, `VALIDATING`, `VALIDATED`, `IMPORTED`, `FAILED`, `CANCELLED`.
- `error_summary` (`JSONB`, Nullable): Detailed row-by-row validation error diagnostics.
- `preview_data` (`JSONB`, Nullable): Stored preview metrics, new/existing entity counts, and parsed records.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).
- *Indexes*: `idx_location_imports_date (uploaded_at)`, `idx_location_imports_status (status)`.

---

### 2.3 Beneficiaries & Land Parcels

#### `beneficiaries`
Agricultural stakeholders receiving water allotments.
- `beneficiary_id` (`UUID`, PK): Permanent UUID.
- `user_id` (`UUID`, Unique, Nullable, FK -> `users`): 1-to-1 link for self-service portal authentication.
- `email` (`VARCHAR(255)`, Nullable): Beneficiary portal email.
- `project_id` (`UUID`, FK -> `projects`): Associated project.
- `district_id` / `panchayat_id` / `village_id` (`UUID`, Nullable, FK): Administrative location hierarchy.
- `full_name` (`VARCHAR(255)`): Farmer legal name.
- `father_or_spouse_name` (`VARCHAR(255)`, Nullable): Patronymic / relative name.
- `phone_number` (`VARCHAR(20)`, Unique): Primary identifier for fast phone lookup.
- `alternate_phone` (`VARCHAR(20)`, Nullable): Backup contact.
- `address_line_1`, `address_line_2`, `address_line_3` (`VARCHAR(255)`, Nullable): Physical address.
- `pincode` (`VARCHAR(10)`, Nullable): Postal PIN code.
- `location_direction` (`LocationDirection`, Nullable): `NORTH`, `SOUTH`, `EAST`, `WEST`.
- `location_description` (`TEXT`, Nullable): Access landmark.
- `identity_doc_type` (`VARCHAR(64)`, Nullable): e.g. `AADHAAR`, `PATTA`.
- `identity_doc_number` (`VARCHAR(128)`, Nullable): Document number.
- `status` (`BeneficiaryStatus`): `ACTIVE`, `INACTIVE`.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).
- *Index*: `idx_beneficiaries_phone (phone_number)`, `idx_beneficiaries_village (village_id)`, `idx_beneficiaries_user (user_id)`.

#### `beneficiary_documents`
Digital document repository for land deeds, approval letters, receipts, and technical reports.
- `document_id` (`UUID`, PK): Permanent primary key.
- `beneficiary_id` (`UUID`, FK -> `beneficiaries`): Document owner.
- `category` (`DocumentCategory`): `LAND_RECORD`, `WATER_APPLICATION`, `APPROVAL_LETTER`, `PAYMENT_RECEIPT`, `INFRASTRUCTURE_REPORT`, `EXTENSION_REQUEST`, `OTHER`.
- `title` (`VARCHAR(255)`): Document display title.
- `file_name` (`VARCHAR(255)`): Storage file name.
- `file_size_bytes` (`INT`, Nullable): File size in bytes.
- `mime_type` (`VARCHAR(128)`): e.g. `application/pdf`.
- `storage_path` (`TEXT`): Object storage URI / path.
- `reference_id` (`VARCHAR(255)`, Nullable): Associated entity ID (e.g. SF number, application ID).
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

#### `land_holdings`
Patta or holding declarations owned by beneficiaries.
- `holding_id` (`UUID`, PK): Primary key.
- `beneficiary_id` (`UUID`, FK -> `beneficiaries`): Owner.
- `patta_number` (`VARCHAR(64)`): Revenue patta number.
- `declared_total_acres` (`NUMERIC(12, 4)`): Declared holding extent in acres.
- `status` (`LandStatus`): `ACTIVE`, `INACTIVE`.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

#### `land_parcels`
Survey numbers and subdivision boundary parcels forming the holding.
- `parcel_id` (`UUID`, PK): Primary key.
- `holding_id` (`UUID`, FK -> `land_holdings`): Parent holding.
- `survey_number` (`VARCHAR(64)`): e.g. `101`.
- `subdivision_number` (`VARCHAR(64)`): e.g. `1A`.
- `area_acres` (`NUMERIC(12, 4)`): Measured area in acres.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).
- *Constraint*: Sum of active `land_parcels.area_acres` must match `declared_total_acres` within `0.0001` tolerance.

---

### 2.4 Tariff & Installment Configuration

#### `rate_configurations`
Immutable rate rules with temporal versioning.
- `rate_id` (`UUID`, PK): Primary key.
- `project_id` (`UUID`, FK -> `projects`): Applicable project.
- `version` (`INT`): Monotonically increasing version counter.
- `litres_per_acre` (`NUMERIC(14, 2)`): Standard allocation density (e.g. 10,000 L/Acre).
- `development_cost_per_litre` (`NUMERIC(14, 2)`): CapEx cost per litre (e.g. ₹2.00).
- `running_cost_per_litre` (`NUMERIC(14, 2)`): OpEx running charge per litre (e.g. ₹0.50).
- `effective_from` (`TIMESTAMPTZ`): Start of validity.
- `effective_to` (`TIMESTAMPTZ`, Nullable): End of validity (NULL = active).
- `created_by` (`UUID`, FK -> `users`): Approving admin.
- `created_at` (`TIMESTAMPTZ`).

#### `installment_templates`
5-stage development cost installment distribution profiles.
- `template_id` (`UUID`, PK): Primary key.
- `project_id` (`UUID`, FK -> `projects`): Applicable project.
- `name` (`VARCHAR(128)`): Template label (e.g. `Standard 5-Stage V1`).
- `stage1_percent` (`NUMERIC(6, 2)`): Stage 1 (Advance) — default `2.50%`.
- `stage2_percent` (`NUMERIC(6, 2)`): Stage 2 — default `20.00%`.
- `stage3_percent` (`NUMERIC(6, 2)`): Stage 3 — default `25.00%`.
- `stage4_percent` (`NUMERIC(6, 2)`): Stage 4 — default `25.00%`.
- `stage5_percent` (`NUMERIC(6, 2)`): Stage 5 — default `27.50%`.
- `is_active` (`BOOLEAN`, Default: `true`).
- *Constraint*: `stage1 + stage2 + stage3 + stage4 + stage5 = 100.00%`.

---

### 2.5 Water Applications & Allotment

#### `water_applications`
Beneficiary request for irrigation quota.
- `application_id` (`UUID`, PK): Primary key.
- `beneficiary_id` (`UUID`, FK -> `beneficiaries`): Applicant.
- `project_id` (`UUID`, FK -> `projects`): Project.
- `application_number` (`VARCHAR(64)`, Unique): e.g. `APP-2026-0001`.
- `required_litres` (`NUMERIC(14, 2)`): Volume requested by applicant.
- `status` (`ApplicationStatus`): `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`.
- `remarks` (`TEXT`, Nullable): Crop / season details.
- `created_by` (`UUID`, FK -> `users`): Field officer who recorded.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

#### `water_allotments`
Approved water quota and legal entitlement.
- `allotment_id` (`UUID`, PK): Primary key.
- `application_id` (`UUID`, FK -> `water_applications`, Unique): 1-to-1 linkage.
- `beneficiary_id` (`UUID`, FK -> `beneficiaries`): Entitled beneficiary.
- `rate_id` (`UUID`, FK -> `rate_configurations`): Snapshot of tariff used.
- `allotment_number` (`VARCHAR(64)`, Unique): e.g. `ALT-2026-0001`.
- `total_land_acres_snapshot` (`NUMERIC(12, 4)`): Total beneficiary land at approval.
- `litres_per_acre_snapshot` (`NUMERIC(14, 2)`): Tariff density at approval.
- `calculated_allotted_litres` (`NUMERIC(14, 2)`): Formula: `total_land * litres_per_acre`.
- `approved_litres` (`NUMERIC(14, 2)`): Admin-sanctioned volume (may override calculated).
- `approved_by` (`UUID`, FK -> `users`): Admin who authorized.
- `approved_at` (`TIMESTAMPTZ`): Approval timestamp.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

---

### 2.6 Billing & 5-Stage Installment Schedules

#### `development_bills`
One-time capital infrastructure cost bill generated upon allotment.
- `bill_id` (`UUID`, PK): Primary key.
- `allotment_id` (`UUID`, FK -> `water_allotments`, Unique): 1-to-1 linkage.
- `bill_number` (`VARCHAR(64)`, Unique): e.g. `DEV-2026-0001`.
- `approved_litres_snapshot` (`NUMERIC(14, 2)`): Sanctioned volume.
- `development_cost_per_litre_snapshot` (`NUMERIC(14, 2)`): Cost rate snapshot.
- `total_amount` (`NUMERIC(14, 2)`): Formula: `approved_litres * cost_per_litre`.
- `paid_amount` (`NUMERIC(14, 2)`, Default: `0.00`): Cumulative payments.
- `pending_balance` (`NUMERIC(14, 2)`): `total_amount - paid_amount`.
- `status` (`BillStatus`): `PENDING`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

#### `installments`
5 milestone-based payment stages per development bill.
- `installment_id` (`UUID`, PK): Primary key.
- `bill_id` (`UUID`, FK -> `development_bills`): Parent bill.
- `installment_number` (`INT`): 1 to 5.
- `percentage` (`NUMERIC(6, 2)`): Percentage portion (e.g. 2.50%).
- `amount` (`NUMERIC(14, 2)`): Target amount for this stage.
- `paid_amount` (`NUMERIC(14, 2)`, Default: `0.00`): Amount paid to date.
- `pending_amount` (`NUMERIC(14, 2)`): `amount - paid_amount`.
- `status` (`InstallmentStatus`): `PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.
- `due_date` (`DATE`, Nullable): Milestone deadline.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).
- *Index*: `idx_installments_bill (bill_id, installment_number)`.

#### `running_bills`
Periodic operational maintenance bills.
- `running_bill_id` (`UUID`, PK): Primary key.
- `allotment_id` (`UUID`, FK -> `water_allotments`): Related allotment.
- `infrastructure_id` (`UUID`, FK -> `infrastructures`): Commissioned infrastructure source.
- `bill_number` (`VARCHAR(64)`, Unique): e.g. `RUN-2026-0001`.
- `billing_period_start` / `billing_period_end` (`DATE`): Period covered.
- `volume_litres` (`NUMERIC(14, 2)`): Consumed or allotted volume.
- `rate_per_litre_snapshot` (`NUMERIC(14, 2)`): Running cost rate.
- `total_amount` (`NUMERIC(14, 2)`): `volume * rate`.
- `paid_amount` / `pending_balance` (`NUMERIC(14, 2)`).
- `status` (`BillStatus`): `PENDING`, `PARTIALLY_PAID`, `PAID`.
- *Gate Rule*: Cannot be created if related infrastructure status is not `COMMISSIONED`.

---

### 2.7 Payments & Financial Ledger

#### `payments`
Immutable transaction ledger of money received.
- `payment_id` (`UUID`, PK): Primary key.
- `receipt_number` (`VARCHAR(64)`, Unique): Sequential fiscal receipt (e.g. `REC-2026-00001`).
- `beneficiary_id` (`UUID`, FK -> `beneficiaries`): Payer.
- `installment_id` (`UUID`, FK -> `installments`, Nullable): Linked installment (if dev bill).
- `running_bill_id` (`UUID`, FK -> `running_bills`, Nullable): Linked running bill.
- `extension_id` (`UUID`, FK -> `extensions`, Nullable): Linked extension fee.
- `amount` (`NUMERIC(14, 2)`): Amount received (Must be > 0).
- `payment_mode` (`PaymentMode`): `CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`, `DD`, `ONLINE`, `OTHER`.
- `transaction_reference` (`VARCHAR(128)`, Nullable): UTR / Cheque / Ref number.
- `payment_date` (`TIMESTAMPTZ`): Payment event time.
- `notes` (`TEXT`, Nullable): Ledger comments.
- `is_reversal` (`BOOLEAN`, Default: `false`): True if this transaction reverses a prior payment.
- `reversal_of_id` (`UUID`, Nullable): References original `payment_id` if this is a reversal.
- `created_by` (`UUID`, FK -> `users`): Accounts officer who recorded.
- `created_at` (`TIMESTAMPTZ`).

---

### 2.8 Infrastructure & Construction Lifecycle

#### `infrastructures`
Physical pipeline, valve, and pump infrastructure execution.
- `infrastructure_id` (`UUID`, PK): Primary key.
- `allotment_id` (`UUID`, FK -> `water_allotments`, Unique): Entitlement served.
- `network_code` (`VARCHAR(64)`, Unique): Asset code (e.g. `INF-2026-0001`).
- `status` (`InfrastructureStatus`): `PLANNED` -> `UNDER_CONSTRUCTION` -> `COMPLETED` -> `COMMISSIONED`.
- `pipeline_length_meters` (`NUMERIC(10, 2)`, Nullable): Pipe length.
- `pipe_diameter_inches` (`NUMERIC(6, 2)`, Nullable): Pipe diameter.
- `planned_start_date` / `actual_commission_date` (`DATE`, Nullable).
- `notes` (`TEXT`, Nullable).
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

---

### 2.9 Extensions Isolation

#### `extensions`
Supplemental water or land requests that extend service without altering base allotment.
- `extension_id` (`UUID`, PK): Primary key.
- `allotment_id` (`UUID`, FK -> `water_allotments`): Root allotment (preserved intact).
- `extension_number` (`VARCHAR(64)`, Unique): e.g. `EXT-2026-0001`.
- `additional_acres` (`NUMERIC(12, 4)`, Default: `0.0000`).
- `additional_litres` (`NUMERIC(14, 2)`): Supplemental requested litres.
- `development_cost` (`NUMERIC(14, 2)`): Extra CapEx calculated.
- `paid_amount` / `pending_balance` (`NUMERIC(14, 2)`).
- `status` (`ExtensionStatus`): `REQUESTED`, `APPROVED`, `REJECTED`, `CANCELLED`.
- `requested_date` (`TIMESTAMPTZ`), `approved_date` (`TIMESTAMPTZ`, Nullable).
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

---

### 2.10 Comprehensive Audit Log

#### `audit_logs`
Cryptographic-grade database mutation audit log.
- `audit_id` (`UUID`, PK): Primary key.
- `user_id` (`UUID`, FK -> `users`, Nullable): Actor (null if automated worker).
- `action` (`AuditAction`): `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `LOGIN`, `LOGOUT`, `PAYMENT`, `REVERSAL`, `OVERRIDE`.
- `entity_type` (`VARCHAR(64)`): Table name or entity concept.
- `entity_id` (`VARCHAR(128)`): ID of target record.
- `old_values` (`JSONB`, Nullable): Prior snapshot before mutation.
- `new_values` (`JSONB`, Nullable): Resulting snapshot after mutation.
- `reason` (`TEXT`, Nullable): Operator notes or approval justification.
- `ip_address` (`VARCHAR(45)`, Nullable): IPv4 or IPv6 client address.
- `created_at` (`TIMESTAMPTZ`, Default: `now()`).
- *Index*: `idx_audit_entity (entity_type, entity_id)`, `idx_audit_user (user_id)`, `idx_audit_created_at (created_at)`.

---

## 3. Snapshotting & Immutability Architecture

```
                                  [Rate Tariff v1]
                                 (10k L/Acre, ₹2/L)
                                          │ (Snapshot)
                                          ▼
[Beneficiary: Ramasamy] ───────► [Water Allotment ALT-01]
 (5.0 Acres declared)            - total_land_acres: 5.0000
                                 - litres_per_acre: 10,000.00
                                 - approved_litres: 50,000.00
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
             [Development Bill DEV-01]          [Infrastructure INF-01]
             - total: ₹100,000.00               - status: PLANNED
                        │                                   │
              (5-Stage Installments)                        ▼
             1:  2.5% = ₹2,500                    UNDER_CONSTRUCTION
             2: 20.0% = ₹20,000                             │
             3: 25.0% = ₹25,000                             ▼
             4: 25.0% = ₹25,000                         COMPLETED
             5: 27.5% = ₹27,500                             │
                        │                                   ▼
             [Payment Ledger REC-01]                   COMMISSIONED
             - paid: ₹2,500                                 │
                                                            ▼
                                                [Running Bill RUN-01]
                                                (Strictly Gated by COMMISSIONED)
```

1. **If Rate Tariff changes to v2** (e.g. ₹3/L, 12,000 L/Acre):
   - Allotment `ALT-01` and Bill `DEV-01` remain at ₹100,000.00 because their figures were snapshotted.
2. **If Beneficiary acquires 2 more acres**:
   - Beneficiary creates an **Extension** `EXT-01` for the 2 acres.
   - Root Allotment `ALT-01` is never rewritten, preventing financial reconciliation errors.
