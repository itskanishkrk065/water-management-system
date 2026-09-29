# Water Management System — API Specification & Route Catalog

## 1. Overview & Protocol Standards

The backend provides a strict, RESTful JSON API.
- **Base URL**: `http://localhost:4000/api/v1`
- **Interactive OpenAPI / Swagger UI**: `http://localhost:4000/api/docs`
- **Content Type**: `application/json`
- **Authentication**: `Authorization: Bearer <access_token>`

### Role-Based Access Control (RBAC) Matrix

| Domain / Action | ADMIN | FIELD_OFFICER | ACCOUNTS | VIEWER | BENEFICIARY |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System & User Management** | Full | None | None | None | None |
| **Location Hierarchy & Projects** | Read/Write | Read | Read | Read | Read |
| **Rate Tariffs (Versioned)** | Read/Write | Read | Read | Read | Read (Snapshot) |
| **Installment Templates** | Read/Write | Read | Read | Read | None |
| **Beneficiary Registration & Land**| Read/Write | Read/Write | Read | Read | Self (Own Holdings) |
| **Water Application Submission** | Read/Write | Read/Write | Read | Read | Self (Own Quota) |
| **Water Application Approval** | Full | None | None | None | None (403 Blocked) |
| **Record & Reverse Payments** | Full | None | Read/Write | Read | None (Treasury Only) |
| **Infrastructure Status Progression**| Full | None | None | Read | Self (Read Pipeline) |
| **Generate Running Charges** | Full | None | Read/Write | Read | Self (Read If Comm.) |
| **Extension Request** | Read/Write | Read/Write | Read | Read | Self (Submit Own) |
| **Extension Approval** | Full | None | None | Read | None (403 Blocked) |
| **Audit Trail Logs** | Read | Read | Read | Read | Self (Own Audit Events) |

---

## 2. Standard Error Response Format

All error responses from the API conform to the structured format:

```json
{
  "statusCode": 400,
  "timestamp": "2026-09-21T16:50:00.000Z",
  "path": "/api/v1/water/allotments/approve",
  "method": "POST",
  "message": "Approved litres cannot exceed calculated entitlement (50000.00 litres)"
}
```

Standard Status Codes:
- `200 OK` / `201 Created`: Request succeeded.
- `400 Bad Request`: Validation failure (DTO constraints, sum mismatch, business rules).
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks required RBAC role.
- `404 Not Found`: Target resource UUID does not exist.
- `409 Conflict`: Unique constraint violation (e.g. phone number, application number duplicate).
- `500 Internal Server Error`: Unhandled server exception.

---

## 3. Route Catalog

### 3.1 Authentication (`/auth`)

#### `POST /auth/login`
Authenticate user with email and password.
- **Roles**: Public
- **Request Body**:
  ```json
  {
    "email": "admin@water.gov",
    "password": "Admin@123456"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "48f12c...",
    "user": {
      "userId": "9059f0f9-...",
      "email": "admin@water.gov",
      "fullName": "Chief Irrigation Engineer",
      "role": "ADMIN"
    }
  }
  ```

#### `POST /auth/refresh`
Refresh expired access token.
- **Roles**: Public
- **Request Body**: `{ "refreshToken": "48f12c..." }`
- **Response `200 OK`**: `{ "accessToken": "...", "refreshToken": "..." }`

#### `POST /auth/logout`
Revoke refresh token and terminate session.
- **Roles**: Authenticated
- **Request Body**: `{ "refreshToken": "48f12c..." }`

#### `GET /auth/me`
Fetch current operator's session profile.
- **Roles**: Authenticated

---

### 3.2 Beneficiaries (`/beneficiaries`)

#### `GET /beneficiaries/lookup?phone=9876543210`
Fast indexed lookup by 10-digit mobile number before onboarding.
- **Roles**: All
- **Response `200 OK`**:
  ```json
  {
    "found": true,
    "beneficiary": {
      "beneficiary_id": "8905b1c2-...",
      "full_name": "Ramasamy Gounder",
      "phone_number": "9876543210",
      "village": { "name": "Annamalai" }
    }
  }
  ```

#### `POST /beneficiaries`
Register new beneficiary.
- **Roles**: `ADMIN`, `FIELD_OFFICER`
- **Request Body**:
  ```json
  {
    "projectId": "859f...",
    "villageId": "10ab...",
    "fullName": "Murugan Velusamy",
    "fatherOrSpouseName": "Velusamy",
    "phoneNumber": "9843210987",
    "alternatePhone": "9843210988",
    "identityDocType": "AADHAAR",
    "identityDocNumber": "1234-5678-9012"
  }
  ```

#### `GET /beneficiaries`
Search and paginate beneficiaries.
- **Query Params**: `page` (default 1), `limit` (default 20), `search` (phone, name, doc number), `villageId`, `projectId`.

#### `GET /beneficiaries/:id`
Fetch complete 360° beneficiary dossier across all 9 tabs: overview, land holdings, parcels, water applications, allotment, development bill, installments, payments, infrastructure, and extensions.

---

### 3.3 Land Holdings & Parcels (`/land`)

#### `POST /land/holdings`
Register land holding with parcels. Enforces: $\sum \text{parcels.areaAcres} = \text{declaredTotalAcres}$.
- **Roles**: `ADMIN`, `FIELD_OFFICER`
- **Request Body**:
  ```json
  {
    "beneficiaryId": "8905b1c2-...",
    "pattaNumber": "PATTA-402",
    "declaredTotalAcres": 3.0,
    "parcels": [
      { "surveyNumber": "102", "subdivisionNumber": "1", "areaAcres": 1.5 },
      { "surveyNumber": "102", "subdivisionNumber": "2", "areaAcres": 1.5 }
    ]
  }
  ```

#### `GET /land/beneficiary/:beneficiaryId`
List all land holdings and parcels for a beneficiary.

#### `GET /land/beneficiary/:beneficiaryId/total`
Returns computed total active acreage: `{ "totalAcres": "3.0000" }`.

---

### 3.4 Rate Tariffs (`/rates`)

#### `GET /rates/active?projectId=:id`
Fetch currently active tariff version.
- **Response**:
  ```json
  {
    "rate_id": "78a9...",
    "version": 1,
    "litres_per_acre": "10000.00",
    "development_cost_per_litre": "2.00",
    "running_cost_per_litre": "0.50",
    "effective_from": "2026-01-01T00:00:00.000Z",
    "effective_to": null
  }
  ```

#### `GET /rates/history?projectId=:id`
Returns full version audit history of tariff rates.

#### `POST /rates`
Create new tariff version. Closes prior active rate's `effective_to`.
- **Roles**: `ADMIN`
- **Request Body**:
  ```json
  {
    "projectId": "859f...",
    "litresPerAcre": 12000,
    "developmentCostPerLitre": 2.25,
    "runningCostPerLitre": 0.60
  }
  ```

---

### 3.5 Water Applications & Allotment (`/water`)

#### `GET /water/preview-allotment?beneficiaryId=:id&projectId=:id`
Preview Section 28 calculations:
- `totalLandAcres`: Computed land.
- `litresPerAcre`: Active rate density.
- `calculatedAllottedLitres`: `totalLand * litresPerAcre`.
- `estimatedDevelopmentCost`: `calculatedAllottedLitres * devCostPerLitre`.

#### `POST /water/applications`
Submit application for required litres.
- **Roles**: `ADMIN`, `FIELD_OFFICER`
- **Request Body**:
  ```json
  {
    "beneficiaryId": "8905b1c2-...",
    "projectId": "859f...",
    "requiredLitres": 30000,
    "remarks": "Sugarcane Kharif cultivation"
  }
  ```

#### `POST /water/allotments/approve`
**Atomic Transactional Approval**:
1. Creates `WaterAllotment` with rate & land snapshots.
2. Creates `DevelopmentBill`.
3. Creates 5 `Installment` records based on project template.
4. Creates `Infrastructure` in `PLANNED` status.
5. Emits `AuditLog`.
- **Roles**: `ADMIN`
- **Request Body**:
  ```json
  {
    "applicationId": "9b12...",
    "approvedLitres": 30000,
    "remarks": "Sanctioned as per canal distribution capacity"
  }
  ```

---

### 3.6 Billing & Installments (`/billing`)

#### `GET /billing/development-bills`
List development bills with payment balances.

#### `GET /billing/installments?billId=:id`
Fetch 5-stage installment breakdown for a bill.

#### `POST /billing/installment-templates`
Create 5-stage template profile. Enforces sum to 100%.
- **Roles**: `ADMIN`
- **Request Body**:
  ```json
  {
    "projectId": "859f...",
    "name": "Standard 5-Stage V2",
    "stage1Percent": 2.5,
    "stage2Percent": 20.0,
    "stage3Percent": 25.0,
    "stage4Percent": 25.0,
    "stage5Percent": 27.5
  }
  ```

#### `POST /billing/running-bills/generate`
**Infrastructure Gated**: Generates periodic running charges bill.
- **Roles**: `ADMIN`, `ACCOUNTS`
- **Prerequisite**: Related infrastructure MUST be `COMMISSIONED`. Throws `400 Bad Request` if `PLANNED`, `UNDER_CONSTRUCTION`, or `COMPLETED`.
- **Request Body**:
  ```json
  {
    "allotmentId": "ab12...",
    "startDate": "2026-06-01",
    "endDate": "2026-06-30",
    "volumeLitres": 30000
  }
  ```

---

### 3.7 Payments & Reversals (`/payments`)

#### `POST /payments`
Record fiscal receipt.
- **Roles**: `ADMIN`, `ACCOUNTS`
- **Request Body**:
  ```json
  {
    "beneficiaryId": "8905b1c2-...",
    "installmentId": "inst-1...",
    "amount": 1400.00,
    "paymentMode": "BANK_TRANSFER",
    "transactionReference": "NEFT12345678",
    "notes": "Installment 1 Advance Payment"
  }
  ```

#### `POST /payments/:id/reverse`
Record an offsetting reversal transaction.
- **Roles**: `ADMIN`, `ACCOUNTS`
- **Request Body**:
  ```json
  {
    "reason": "Bank cheque bounced due to drawer signature mismatch"
  }
  ```

---

### 3.8 Infrastructure Grid (`/infrastructure`)

#### `GET /infrastructure`
List infrastructure grid assets with lifecycle statuses.

#### `PATCH /infrastructure/:id/status`
Progress lifecycle status: `PLANNED` -> `UNDER_CONSTRUCTION` -> `COMPLETED` -> `COMMISSIONED`.
- **Roles**: `ADMIN`
- **Request Body**:
  ```json
  {
    "status": "COMMISSIONED",
    "notes": "Field testing and pressure verification completed successfully."
  }
  ```

---

### 3.9 Extensions (`/extensions`)

#### `POST /extensions`
Submit supplemental quota extension request.
- **Roles**: `ADMIN`, `FIELD_OFFICER`
- **Request Body**:
  ```json
  {
    "allotmentId": "alt-01...",
    "additionalAcres": 1.5,
    "additionalLitres": 15000,
    "notes": "Acquired adjacent parcel SF 103"
  }
  ```

#### `POST /extensions/:id/approve`
Approves extension and creates standalone bill. Leaves root allotment unchanged.
- **Roles**: `ADMIN`

---

### 3.10 Audit Trail & Monitoring (`/audit`, `/dashboard`)

#### `GET /audit`
Fetch immutable audit trail records.
- **Query Params**: `entityType`, `entityId`, `action`, `userId`, `limit`, `offset`.

#### `GET /dashboard/stats`
Aggregated KPIs: Total beneficiaries, total land acres, allotted litres, total billed, total collected, pending balance.

#### `GET /dashboard/pending-approvals`
Queue of water applications awaiting Admin review.

#### `GET /dashboard/infrastructure-queue`
Queue of infrastructure pending commissioning.

---

### 3.11 Beneficiary Self-Service Portal (`/beneficiary/*`)

All routes under `/beneficiary/*` enforce `@Roles(RoleName.BENEFICIARY, RoleName.ADMIN)`. Identity is determined strictly from the JWT bearer token (`req.user.beneficiary_id`), ensuring multi-tenant isolation. Beneficiary A receives `404 Not Found` when attempting to access Beneficiary B's holdings, applications, bills, installments, payments, or receipts.

#### `GET /beneficiary/me`
Fetches authenticated beneficiary profile, 5-stage onboarding completion percentage (0–100%), and milestone checklist.

#### `PATCH /beneficiary/me`
Updates beneficiary physical address, postal PIN, cardinal direction, and location landmark.
- **Request Body**:
  ```json
  {
    "districtId": "dis-uuid",
    "panchayatId": "pan-uuid",
    "villageId": "vil-uuid",
    "addressLine1": "Door 4/12, Main Road",
    "pincode": "641604",
    "locationDirection": "NORTH",
    "locationDescription": "500m West of Main Canal"
  }
  ```

#### `GET /beneficiary/dashboard`
Aggregated overview payload containing land totals, approved/requested water quotas, billing balances, next due installment, and infrastructure commissioning status.

#### `GET /beneficiary/land`
Lists all land holdings and survey parcels owned by the authenticated beneficiary with computed active extent.

#### `POST /beneficiary/land`
Registers a new land holding with individual SF / subdivision parcels. Enforces strict checksum: $\sum \text{parcels} = \text{declared area}$ within $0.0001$ acre tolerance.
- **Request Body**:
  ```json
  {
    "declaredTotalArea": 3.5,
    "parcels": [
      { "surveyNumber": "104/1A", "subdivisionNumber": "1", "areaAcres": 2.0 },
      { "surveyNumber": "104/1B", "subdivisionNumber": "2", "areaAcres": 1.5 }
    ]
  }
  ```

#### `GET /beneficiary/land/:id`
Retrieves single land holding and SF parcels. Returns `isLocked: true` if referenced by an approved water allotment.

#### `GET /beneficiary/water/preview`
Transparent Section 28 mathematical formula preview:
$\text{Total Registered Land} \times \text{Tariff Litres/Acre} = \text{Calculated Allocation Quota}$.

#### `POST /beneficiary/water/applications`
Submits a water quota allocation request for administration review.
- **Request Body**:
  ```json
  {
    "requiredLitres": 35000
  }
  ```

#### `GET /beneficiary/water/applications`
Lists all historical water applications and review statuses (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).

#### `GET /beneficiary/allotments`
Returns approved water allotments, snapshotted historical tariff rates, and development bill summaries.

#### `GET /beneficiary/installments`
Retrieves the 5-stage development bill installment schedule, amounts due, paid, pending, and due dates.

#### `GET /beneficiary/payments`
Lists all completed payments recorded on the beneficiary's ledger.

#### `GET /beneficiary/receipts/:id`
Returns official printable fiscal receipt data (Project, Receipt Number, Mode, Transaction Ref, Beneficiary Particulars, Milestone Info, Amount).

#### `GET /beneficiary/infrastructure`
Returns physical pipeline grid construction status (`PLANNED`, `UNDER_CONSTRUCTION`, `COMPLETED`, `COMMISSIONED`) and commissioning date.

#### `GET /beneficiary/running-bills`
Returns recurring monthly operation bills. Strictly gated: returns `isInfrastructureCommissioned: false` and empty bill list if infrastructure is not yet commissioned.

#### `GET /beneficiary/extensions` & `POST /beneficiary/extensions`
Lists and submits supplementary quota extensions without altering or overwriting root allotment records.

#### `GET /beneficiary/documents` & `POST /beneficiary/documents`
Lists and registers digital documents categorized by `LAND_RECORD`, `WATER_APPLICATION`, `APPROVAL_LETTER`, `PAYMENT_RECEIPT`, `INFRASTRUCTURE_REPORT`, `EXTENSION_REQUEST`, `OTHER`.

#### `GET /beneficiary/history`
Returns chronological audit timeline derived from PostgreSQL audit logs covering all lifecycle events on the account.

---

### 3.12 Geographic Locations & Cascading Hierarchy (`/locations`)

#### `GET /locations/districts`
Fetch all administrative districts.
- **Query Params**: `search` (string), `activeOnly` (boolean).
- **Response `200 OK`**:
  ```json
  [
    {
      "district_id": "8905b1c2-...",
      "lgd_district_code": 528,
      "name": "Kancheepuram",
      "is_active": true,
      "_count": { "blocks": 13, "beneficiaries": 45 }
    }
  ]
  ```

#### `GET /locations/districts/:districtId/blocks`
Fetch cascading blocks belonging strictly to a parent district.
- **Query Params**: `search` (string), `activeOnly` (boolean).
- **Response `200 OK`**:
  ```json
  [
    {
      "block_id": "60a1...",
      "district_id": "8905b1c2-...",
      "lgd_block_code": 6482,
      "name": "Kancheepuram",
      "is_active": true,
      "_count": { "villages": 42 }
    }
  ]
  ```

#### `GET /locations/blocks/:blockId/villages`
Fetch cascading villages belonging strictly to a parent block (supports server-side search and pagination).
- **Query Params**: `search` (string), `page` (default 1), `limit` (default 50), `activeOnly` (boolean).
- **Response `200 OK`**:
  ```json
  {
    "items": [
      {
        "village_id": "90b2...",
        "block_id": "60a1...",
        "lgd_village_code": 223994,
        "name": "Angambakkam",
        "is_active": true
      }
    ],
    "meta": {
      "total": 42,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  }
  ```

#### `GET /locations/villages/:villageId`
Fetch village particulars including parent block and district details.

#### `GET /locations/search?search=coimbatore&limit=10`
Global indexed search across districts, blocks, and villages.

#### `GET /locations/tree`
Hierarchical tree of districts, blocks, and sample villages.

---

### 3.13 Admin Location Master Data Import (`/admin`)

All routes under `/admin/location-import*` enforce `@Roles(RoleName.ADMIN)` with JWT authentication.

#### `POST /admin/location-import`
Upload and validate LGD Excel spreadsheet (`.xls`, `.xlsx`).
- **Content-Type**: `multipart/form-data`
- **Payload**: `file` (Excel binary)
- **Validation**:
  - Column matching (tolerant of spaces and case): `LGD District Code`, `District Name`, `LGD Block code`, `Block Name`, `LGD Village Code`, `Village Name`.
  - Data integrity: positive integer codes, non-empty names, duplicate/conflict detection.
  - Generates cryptographic SHA-256 hash and records `LocationImport` entity.
- **Response `201 Created`**:
  ```json
  {
    "importId": "866014e5-...",
    "fileName": "village_eng1.xls",
    "fileHash": "022d4f...",
    "status": "VALIDATED",
    "totalRows": 12525,
    "validRows": 12525,
    "invalidRows": 0,
    "newDistricts": 36,
    "existingDistricts": 1,
    "newBlocks": 385,
    "existingBlocks": 3,
    "newVillages": 12521,
    "existingVillages": 4,
    "potentialDuplicates": 0,
    "sampleValidRows": [...],
    "errors": []
  }
  ```

#### `POST /admin/location-import/:id/confirm`
Executes transactional database upsert into PostgreSQL (`districts`, `blocks`, `villages`).
- **Response `201 Created`**:
  ```json
  {
    "message": "Location master data successfully imported into PostgreSQL database.",
    "importId": "866014e5-...",
    "status": "IMPORTED",
    "summary": {
      "districtsCreated": 36,
      "districtsUpdated": 1,
      "blocksCreated": 385,
      "blocksUpdated": 3,
      "villagesCreated": 12521,
      "villagesUpdated": 4,
      "totalDistricts": 37,
      "totalBlocks": 388,
      "totalVillages": 12525
    }
  }
  ```

#### `GET /admin/location-imports`
List previous location import batches and statuses (`page`, `limit`).

#### `GET /admin/location-imports/:id`
Fetch single import batch diagnostics and error logs.

#### `POST /admin/location-import/:id/cancel`
Cancel or discard a pending validated import run.

---

### Find, Filter & Reporting Module (`/reports/find`)

#### `POST /reports/find`
Executes dynamic multi-entity query and returns paginated records alongside whole-population decimal-safe aggregate metrics.
- **Roles**: `ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`, `VIEWER`
- **Request Body (`FindFilterDto`)**:
  ```json
  {
    "districtId": "dis-uuid",
    "blockId": "blk-uuid",
    "villageId": "vil-uuid",
    "beneficiaryName": "Ravi",
    "phoneNumber": "98765",
    "landAreaMin": 5.0,
    "landAreaMax": 10.0,
    "requiredLitresMin": 10000,
    "paymentStatus": "UNPAID",
    "installmentNumber": 1,
    "infrastructureStatus": "COMMISSIONED",
    "dateType": "application_date",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31",
    "page": 1,
    "limit": 50
  }
  ```
- **Response**:
  ```json
  {
    "items": [
      {
        "beneficiaryId": "ben-uuid",
        "name": "Ravi Kumar",
        "phoneNumber": "9876543210",
        "districtName": "Kancheepuram",
        "blockName": "Kancheepuram",
        "villageName": "Angambakkam",
        "totalLandAcres": "8.5000",
        "approvedLitres": "25000.00",
        "developmentCost": "50000.00",
        "amountPaid": "0.00",
        "pendingBalance": "50000.00",
        "paymentStatus": "UNPAID",
        "infrastructureStatus": "COMMISSIONED",
        "applicationStatus": "APPROVED"
      }
    ],
    "metrics": {
      "beneficiaries": { "total": 38, "active": 38, "inactive": 0 },
      "land": { "totalLandAcres": "126.4000", "totalHoldings": 42, "totalParcels": 84 },
      "water": { "totalRequiredLitres": "1264000.00", "totalCalculatedLitres": "1190000.00", "totalApprovedLitres": "980000.00" },
      "financials": { "totalDevelopmentCost": "1960000.00", "totalAmountDue": "1960000.00", "totalAmountPaid": "0.00", "totalPending": "1960000.00" },
      "paymentBeneficiaries": { "paid": 0, "partiallyPaid": 0, "unpaid": 38, "overdue": 0 },
      "installments": { "total": 190, "paid": 0, "partiallyPaid": 0, "pending": 190, "overdue": 0, "amountDue": "1960000.00", "amountPaid": "0.00", "pendingBalance": "1960000.00" },
      "infrastructure": { "planned": 14, "underConstruction": 12, "completed": 5, "commissioned": 7 },
      "extensions": { "totalRequests": 0, "pending": 0, "approved": 0, "rejected": 0, "additionalLitresRequested": "0.00", "additionalLitresApproved": "0.00" }
    },
    "meta": {
      "total": 38,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  }
  ```

#### `GET /reports/find/metadata`
Retrieves reporting dropdown options, supported enums, and date type definitions.
- **Roles**: `ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`, `VIEWER`

#### `POST /reports/find/export/pdf`
Server-side generation and streaming of an authoritative, formatted landscape PDF report representing the exact filtered population.
- **Roles**: `ADMIN`, `FIELD_OFFICER`, `ACCOUNTS`
- **Response**: `application/pdf` binary stream with `Content-Disposition: attachment; filename="water-management-report-..."`.

