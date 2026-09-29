# Water Management System — Production-Grade V1

> **Enterprise-grade irrigation quota distribution, land parcel validation, 5-stage installment billing, infrastructure commissioning, and immutable financial audit platform.**

Built for real-world government and irrigation authority deployments with strict **PostgreSQL `NUMERIC`** decimal precision, transactional integrity, temporal rate versioning, role-based access control, and complete audit traceability.

---

## 🌟 Key Functional Capabilities

1. **Beneficiary Identification & Phone Lookup Workflow**:
   - First step of onboarding checks 10-digit mobile number in sub-millisecond indexed database query.
   - If found, redirects to existing dossier; if new, unlocks registration with permanent UUID.
2. **Dynamic Land Holdings & SF/Subdivision Parcels**:
   - Beneficiaries declare land holdings with multiple survey number and subdivision parcels.
   - Strict database & application checksum: $\sum \text{parcels.area} = \text{declared holding area}$ (accurate to 0.0001 acre).
   - Dynamic aggregation across all active holdings without stale cached sums.
3. **Versioned Rate Configurations (Tariff History)**:
   - Tariffs (`litres_per_acre`, `development_cost_per_litre`, `running_cost_per_litre`) are append-only.
   - Past records are never overwritten in-place, preserving complete temporal audit history.
4. **Section 28 Allotment Calculation & Atomic Approval**:
   - Field officers submit water applications with real-time preview: $\text{Total Land} \times \text{Litres/Acre} \times \text{Rate/Litre}$.
   - Administrators sanction approved quotas via an **ACID database transaction**:
     - Snapshots land acreage and tariff density at the instant of approval.
     - Generates one-time `DevelopmentBill`.
     - Generates 5 `Installment` milestones (Installment 1 = 2.5% advance; Installments 2–5 sum to 100%).
     - Creates physical `Infrastructure` tracking record in `PLANNED` status.
     - Emits structured `AuditLog` entry.
5. **Infrastructure Lifecycle & Running Charges Gating**:
   - Lifecycle stages: `PLANNED` $\to$ `UNDER_CONSTRUCTION` $\to$ `COMPLETED` $\to$ `COMMISSIONED`.
   - **Strict Commissioning Gate**: Operational running charge bills **cannot** be generated until infrastructure status is `COMMISSIONED`.
6. **Isolated Extensions Architecture**:
   - Supplemental land or water requests create independent extension records.
   - Approving an extension never alters or overwrites the root allotment or original development bill.
7. **Official LGD Location Master & Excel Import Engine**:
   - Direct upload & parsing of Local Government Directory (LGD) spreadsheets (`.xls`, `.xlsx`).
   - Strict 3-tier hierarchy: **District (1) $\to$ Block (N) $\to$ Village (N)** (blocks are distinct entities from panchayats).
   - Multi-phase import workflow: Upload $\to$ Parse $\to$ Validate $\to$ Preview Metrics $\to$ Admin Confirm $\to$ PostgreSQL Transactional Upsert.
   - Preserves official names and LGD codes as stable external identifiers without destroying existing beneficiary references.
8. **Cascading Dropdowns & Server-Side Search**:
   - Progressive dynamic selection (District $\to$ Block $\to$ Village) with downstream auto-clear on parent change.
   - Paginated, searchable village endpoint handles tens of thousands of revenue villages efficiently.
   - Dual-layer backend verification: strictly rejects any beneficiary record where the block does not belong to the district, or the village does not belong to the block.
9. **Immutable Financial Ledger & Reversals**:
   - Payments are append-only with sequential fiscal receipt generation.
   - Accounting corrections occur via offsetting reversal transactions (`is_reversal: true`), maintaining an uncorrupted paper trail.
10. **Comprehensive System Audit Trail**:
   - Full event sink with JSON diffs (`old_values`, `new_values`), actor ID, IP address, and timestamp.
   - Dedicated UI inspector with search, filters, and JSON viewer.
11. **Advanced Find, Filter & Authoritative Reporting Engine**:
   - Centralized multi-entity filtering query engine across Beneficiaries, Land, Water, 5-Stage Installments, Financials, Infrastructure, and Extensions.
   - Decimal-safe whole-population aggregations calculated directly in PostgreSQL without join duplication.
   - Authoritative server-side landscape PDF export (`POST /reports/find/export/pdf`) with active filter metadata, KPI cards, and multi-page record table.
   - Interactive UI at `/admin/find` and `/reports/find` with collapsible filter sections, cascading location selectors, active chips, and URL query bookmarking.

---

## 🛠 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | NestJS, TypeScript, REST API, OpenAPI/Swagger, Prisma ORM |
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, Lucide Icons |
| **Database** | PostgreSQL 16 (strict `NUMERIC` types, foreign keys, unique constraints, ACID transactions) |
| **Cache & Queue** | Redis 7 (via Docker) |
| **Authentication**| Passport.js, JWT (Access & Refresh tokens), bcrypt, RBAC Guards |
| **DevOps** | Multi-stage Dockerfiles, Docker Compose |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20+
- Docker Desktop & Docker Compose

### 2. Start PostgreSQL & Redis
```bash
docker compose up -d postgres redis
```

### 3. Initialize Backend Database & Seed
```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
```

### 4. Run Development Servers
In separate terminals:
```bash
# Terminal 1: Backend API (Port 4000)
cd backend
npm run start:dev

# Terminal 2: Frontend UI (Port 3000)
cd frontend
npm install
npm run dev
```

### 5. Access the Platform
- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **Interactive Swagger Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

## 👥 Demo Credentials & Role Switcher

The database is pre-seeded with 5 role-based accounts (Password: `Admin@123456`):

| Role | Email | Capabilities |
| :--- | :--- | :--- |
| **Admin** | `admin@water.gov` | All approvals, tariff configuration, templates, infrastructure commissioning, user administration. |
| **Field Officer** | `field@water.gov` | Beneficiary onboarding, SF/subdivision land recording, water application submissions. |
| **Accounts** | `accounts@water.gov` | Payment collection, receipts, 5-stage installments, running charges, payment reversals. |
| **Viewer** | `viewer@water.gov` | Read-only inspection of dashboards, dossiers, audit logs, and status tracking. |
| **Beneficiary** | `beneficiary@water.gov` | Self-service portal: profile wizard, land holdings, water quota application, installments, receipts, infrastructure, extensions, documents, and audit history. |

> **Tip**: Use the **Quick Role Switcher** in the top navigation bar to seamlessly test permissions without re-typing passwords.

---

## 🧪 Automated Testing

### Backend Unit Tests (Section 34)
Executes pure business logic calculations with Decimal arithmetic:
```bash
cd backend
npm test
```
*Result: 7/7 tests passing.*

### Integration & End-to-End Test Suite (46 Scenarios)
Verifies full application lifecycle, strict multi-tenant beneficiary data isolation, and security against PostgreSQL:
```bash
cd backend
npm run test:e2e
```
*Result: 46/46 tests passing (20 Operational Admin tests + 26 Beneficiary Portal E2E tests).*

### Frontend Production Build
Validates TypeScript compilation and Next.js static optimization:
```bash
cd frontend
npm run build
```
*Result: 38/38 routes compiled cleanly with 0 type errors.*

---

## 📚 Complete Documentation Index

For in-depth technical details, refer to the documentation suite:

* 📐 [**ARCHITECTURE.md**](./ARCHITECTURE.md) — Architectural design, module boundaries, system topologies, history/versioning strategy, and security model.
* 🗄 [**DATABASE.md**](./DATABASE.md) — Relational schema catalog, column types, constraints, snapshotting strategies, and decimal handling.
* 🔌 [**API.md**](./API.md) — Comprehensive REST API route catalog, request/response DTOs, RBAC permissions matrix, and error formats.
* 💻 [**DEVELOPMENT.md**](./DEVELOPMENT.md) — Developer setup instructions, Docker commands, seed management, testing guide, and coding standards.

---

## 📁 Repository Structure

```
.
├── ARCHITECTURE.md            # System architecture specification
├── DATABASE.md                # Database schema & entity specifications
├── API.md                     # REST API catalog & RBAC matrix
├── DEVELOPMENT.md             # Local setup & testing instructions
├── README.md                  # Project overview & documentation hub
├── docker-compose.yml         # Container orchestration (Postgres, Redis, Backend, Frontend)
├── backend/
│   ├── src/
│   │   ├── modules/           # 16 domain modules (auth, beneficiary-portal, water, billing, land, etc.)
│   │   └── main.ts            # NestJS entrypoint with Swagger & global validation
│   ├── prisma/
│   │   ├── schema.prisma      # Database models, enums, indexes, and relations
│   │   └── seed.ts            # Starter projects, locations, tariffs, and users
│   ├── test/                  # End-to-end integration test suites (workflow & beneficiary-portal)
│   └── Dockerfile             # Multi-stage production container build
└── frontend/
    ├── src/
    │   ├── app/               # Next.js App Router (38 production pages, admin & beneficiary portals)
    │   ├── components/        # Layout, Sidebar, Navbar, and UI widgets
    │   └── lib/               # TanStack query client, AuthContext, Axios, formatters
    └── Dockerfile             # Multi-stage Next.js production build
```
