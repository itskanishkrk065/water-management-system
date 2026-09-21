# Water Management System — API Specification & Route Catalog

## 1. Overview & Protocol Standards

The backend provides a strict, RESTful JSON API.
- **Base URL**: `http://localhost:4000/api/v1`
- **Interactive OpenAPI / Swagger UI**: `http://localhost:4000/api/docs`
- **Content Type**: `application/json`
- **Authentication**: `Authorization: Bearer <access_token>`

### Role-Based Access Control (RBAC) Matrix

| Domain / Action | ADMIN | FIELD_OFFICER | ACCOUNTS | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **System & User Management** | Full | None | None | None |
| **Location Hierarchy & Projects** | Read/Write | Read | Read | Read |
| **Rate Tariffs (Versioned)** | Read/Write | Read | Read | Read |
| **Installment Templates** | Read/Write | Read | Read | Read |
| **Beneficiary Registration & Land**| Read/Write | Read/Write | Read | Read |
| **Water Application Submission** | Read/Write | Read/Write | Read | Read |
| **Water Application Approval** | Full | None | None | None |
| **Record & Reverse Payments** | Full | None | Read/Write | Read |
| **Infrastructure Status Progression**| Full | None | None | Read |
| **Generate Running Charges** | Full | None | Read/Write | Read |
| **Extension Request** | Read/Write | Read/Write | Read | Read |
| **Extension Approval** | Full | None | None | Read |
| **Audit Trail Logs** | Read | Read | Read | Read |

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
