# Water Management System — Local Development Guide

## 1. Prerequisites

Before setting up the project locally, ensure you have the following installed:
- **Node.js**: `v20.x` or later (LTS recommended)
- **npm**: `v10.x` or later
- **Docker & Docker Compose**: Docker Desktop 4.x+ (or Docker Engine on Linux)
- **Git**

---

## 2. Environment Configuration

The repository includes pre-configured environment templates.

### Root `.env`
Controls the Docker Compose services and database parameters:
```bash
cp .env.example .env
```
Default parameters in `.env`:
```ini
POSTGRES_USER=water_admin
POSTGRES_PASSWORD=water_secret_pass
POSTGRES_DB=water_management
POSTGRES_PORT=5432
REDIS_PORT=6379
JWT_SECRET=super-secret-jwt-key-for-water-management-v1-32chars
JWT_REFRESH_SECRET=super-secret-refresh-jwt-key-water-mgmt-v1
```

### Backend `.env` (`backend/.env`)
Create or verify `backend/.env`:
```ini
DATABASE_URL="postgresql://water_admin:water_secret_pass@localhost:5432/water_management?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=4000
JWT_SECRET="super-secret-jwt-key-for-water-management-v1-32chars"
JWT_REFRESH_SECRET="super-secret-refresh-jwt-key-water-mgmt-v1"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
```

---

## 3. Step-by-Step Setup

### Step 1: Start Infrastructure (Postgres & Redis)
From the repository root:
```bash
docker compose up -d postgres redis
```
Verify the health check passes:
```bash
docker compose ps
# Both water_postgres and water_redis should report "Up (healthy)"
```

### Step 2: Install Backend Dependencies & Apply Database Schema
```bash
cd backend
npm install

# Push schema to PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed initial database records
npx prisma db seed
```

### Step 3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

---

## 4. Running the Development Servers

Run backend and frontend in separate terminal windows:

### Terminal 1 — Backend (Port 4000)
```bash
cd backend
npm run start:dev
```
- API Endpoint: `http://localhost:4000/api/v1`
- Swagger UI / OpenAPI Docs: `http://localhost:4000/api/docs`

### Terminal 2 — Frontend (Port 3000)
```bash
cd frontend
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 5. Demo Accounts & Seed Credentials

The database seed (`prisma/seed.ts`) populates role-based demonstration accounts with password `Admin@123456`:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@water.gov` | `Admin@123456` | Full system access, water application approvals, rate configuration versioning, installment templates, infrastructure commissioning. |
| **Field Officer** | `field@water.gov` | `Admin@123456` | Beneficiary phone lookup, profile registration, SF/subdivision land holdings, water application submissions. |
| **Accounts** | `accounts@water.gov` | `Admin@123456` | Payment recording, 5-stage installment collections, running charges billing, receipts, payment reversals. |
| **Viewer** | `viewer@water.gov` | `Admin@123456` | Read-only inspection of dashboards, dossiers, audit logs, and status tracking. |
| **Beneficiary** | `beneficiary@water.gov` | `Admin@123456` | Dedicated self-service portal: profile wizard, land holdings, water quota application, installments, receipts, infrastructure, extensions, documents, and audit history. |

> **Quick Switcher**: The frontend navigation bar includes a one-click demo role switcher to test role permissions on the fly.

---

## 6. Running Automated Tests

### Backend Unit Tests (Section 34)
Executes pure business logic calculations with Decimal arithmetic:
```bash
cd backend
npm test
```
*Tests cover: total land calculations, parcel checksums, allotment densities, development costs, 5 installments 100% distribution, payment balances, and extension formulas (7/7 passed).*

### End-to-End Integration & RBAC Tests (46 Scenarios)
Runs full lifecycle and security verification against PostgreSQL:
```bash
cd backend
npm run test:e2e
```
*Tests cover: phone lookup, parcel sum enforcement, application submission, atomic transactional approval, 5 installment generation, payment recording, infrastructure commissioning gate, extension isolation, RBAC restrictions, audit logging, beneficiary signup, profile completion scoring, water preview formulas, strict multi-tenant tenant isolation, and audit timeline (46/46 passed).*

### Frontend Production Build
Verifies TypeScript compilation, Next.js App Router static optimization, and bundle integrity:
```bash
cd frontend
npm run build
```
*Result: 38/38 routes compiled cleanly with 0 type errors.*

---

## 7. Docker Full Stack Deployment

To run the entire system (PostgreSQL, Redis, NestJS Backend, Next.js Frontend) in production container mode:

```bash
# Build and run all services
docker compose up --build -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

Access:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`
- Swagger Documentation: `http://localhost:4000/api/docs`

---

## 8. Coding Standards & Architectural Guidelines

1. **Exact Decimal Math**:
   - Never use JavaScript native `Number` floats for currency or volumes.
   - Use `Decimal` from `decimal.js` or `backend/src/modules/common/utils/decimal.util.ts`:
     ```ts
     import { d, toDecimalString } from '../common/utils/decimal.util';
     const total = d(landAcres).mul(litresPerAcre);
     ```
2. **Audit Logging**:
   - Always log mutations via `auditService.log({ ... })` within the same transaction client `tx`.
3. **Strict Validation**:
   - Use `class-validator` decorators on all backend DTOs.
   - Use `zod` schemas on the frontend.
4. **Snapshot Preservation**:
   - Never update historical rate records in place.
   - Never mutate the root allotment record when an extension is approved.
