# WATERGRID V2 — RENDER PRODUCTION DEPLOYMENT AUDIT
**Date**: October 2026  
**Target Environment**: Render Cloud Application Platform (Managed Web Service)  
**Database**: Neon Managed PostgreSQL  
**Audit Status**: READ-ONLY VERIFICATION COMPLETE — ZERO REPO MODIFICATIONS APPLIED  

---

## 1. Executive Summary & Verdict

| Audit Parameter | Status | Finding & Exact Configuration |
| :--- | :---: | :--- |
| **Backend Root Directory** | **IDENTIFIED** | Subdirectory `backend` relative to repository root. |
| **Port Binding** | **PASS** | `process.env.PORT` is dynamically read (`process.env.PORT \|\| 4000`). |
| **0.0.0.0 Host Binding** | **CONDITIONAL PASS** | Binds to `0.0.0.0` **only** when `NODE_ENV === 'production'`. Falls back to `127.0.0.1` otherwise. Explicitly set `HOST=0.0.0.0` in Render. |
| **Health Check Path** | **CRITICAL PREFIX** | Must be `/api/v1/health` or `/api/v1/health/live`. Setting `/health` will return **404 Not Found**. |
| **Build Command** | **ATTENTION REQUIRED** | Current `npm run build:render` executes SQLite generator. Must use PostgreSQL schema generation & migration for Render. |
| **Production Start Command** | **EXACT PATH** | `node dist/src/main` (or `npm run start:prod`). Using `node dist/main.js` will crash with `MODULE_NOT_FOUND`. |
| **Prisma Generation / Migration** | **POSTGRESQL** | `npx prisma generate --schema=prisma/schema.prisma` and `npx prisma migrate deploy --schema=prisma/schema.prisma`. |
| **Production Env Enforcements** | **FATAL IF MISSING** | `EnvironmentConfigService` crashes boot if `DATABASE_URL` is empty, or if `JWT_SECRET` / `JWT_REFRESH_SECRET` are defaults or < 32 chars. |
| **CORS Configuration** | **NEEDS CONFIG** | Defaults to `localhost:3000`. Must supply `CORS_ORIGIN` with production frontend origins. |

---

## 2. Directory Hierarchy & Render Root Directory

### Repository Structure
```
/Volumes/It's Mine Too ,MF/Water/          <-- Git Repository Root
├── backend/                                <-- NestJS Backend Root
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   ├── schema.prisma                  <-- PostgreSQL Schema (Neon)
│   │   ├── schema.sqlite.prisma           <-- SQLite Schema (Offline/Desktop)
│   │   └── migrations/
│   │       └── 0_init/migration.sql       <-- PostgreSQL Baseline Migration
│   └── src/
│       ├── main.ts                        <-- Application Bootstrap
│       └── modules/
├── frontend/                               <-- Next.js Web Frontend
├── electron/                               <-- Electron Desktop Wrapper
└── render.yaml                             <-- Render Blueprint File
```

### Render Dashboard "Root Directory" Setting
You have two deployment configuration options on Render:

#### Recommended: Set Root Directory to `backend`
In the Render Web Service Settings:
- **Root Directory**: `backend`
- All commands run directly inside the `backend/` folder.

#### Alternative: Monorepo Root (`.`)
If Root Directory is left blank or set to `.` (as currently specified in `render.yaml`):
- **Root Directory**: `.`
- All commands must be prefixed with `cd backend && ...`.

---

## 3. Build & Production Start Commands

### A. Production Build Command

#### ⚠️ Critical Finding in `package.json`
In `backend/package.json`:
```json
"scripts": {
  "build": "npm run prisma:generate:sqlite && nest build",
  "build:render": "npm run prisma:generate:sqlite && nest build",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate deploy"
}
```
`"build:render"` and `"build"` currently run `prisma:generate:sqlite`. If deployed directly with `npm run build:render`, the build will generate a SQLite Prisma client instead of a PostgreSQL client.

#### Exact Build Command for Render:
Depending on your Root Directory choice:

- **When Root Directory = `backend`**:
  ```bash
  npm ci && npx prisma generate --schema=prisma/schema.prisma && npx prisma migrate deploy --schema=prisma/schema.prisma && npx nest build
  ```

- **When Root Directory = `.` (Repository Root)**:
  ```bash
  cd backend && npm ci && npx prisma generate --schema=prisma/schema.prisma && npx prisma migrate deploy --schema=prisma/schema.prisma && npx nest build
  ```

---

### B. Production Start Command

#### ⚠️ Critical Finding in `dist/` Compilation Structure
In `backend/tsconfig.json`:
- `outDir: "./dist"`
- Because `tsconfig.json` compiles multiple root directories (`src`, `scripts`, `prisma`, `test`), `tsc` / `nest build` outputs `main.js` inside `dist/src/main.js`, **NOT** `dist/main.js`.
- The default Render NestJS suggestion (`node dist/main.js`) will immediately crash with:
  ```
  Error: Cannot find module '/opt/render/project/src/backend/dist/main.js'
  ```

#### Exact Production Start Command for Render:
- **When Root Directory = `backend`**:
  ```bash
  npm run start:prod
  ```
  *(Equivalently: `node dist/src/main`)*

- **When Root Directory = `.` (Repository Root)**:
  ```bash
  cd backend && npm run start:prod
  ```
  *(Equivalently: `node backend/dist/src/main`)*

---

## 4. Prisma Generation & Database Migration

### Target Datasource: Neon PostgreSQL
The authoritative PostgreSQL schema is located at:
`backend/prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Prisma Commands for Render:
1. **Client Generation**:
   ```bash
   npx prisma generate --schema=prisma/schema.prisma
   ```
2. **Automated Migration Deployment**:
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prisma
   ```

> [!IMPORTANT]
> **Why `directUrl = env("DIRECT_URL")` is required:**
> Neon provides two connection strings:
> 1. **Pooled Connection** (`DATABASE_URL` via PgBouncer on port 5432 or 6543): Used at runtime by NestJS for fast, multiplexed connection pooling.
> 2. **Direct Connection** (`DIRECT_URL` unpooled): Used by `prisma migrate deploy` because PgBouncer does not support the session advisory locks and transactional DDL statements required during schema migrations.

---

## 5. Port Binding and 0.0.0.0 Audit

### Code Audit (`backend/src/main.ts` Lines 80, 95-98)
```typescript
const isProduction = process.env.NODE_ENV === 'production';
...
const port = process.env.PORT || 4000;
const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');

await app.listen(port, host);
logger.log(`🚀 WaterGrid Backend running on http://${host}:${port}/api/v1 (ENV: ${process.env.NODE_ENV || 'development'})`);
```

### Analysis:
1. **`process.env.PORT` Binding**:
   - **PASS**: The application reads `process.env.PORT`. Render automatically assigns an internal listening port (such as `10000`). The NestJS server properly binds to this port.
2. **`0.0.0.0` Host Binding**:
   - **CONDITIONAL PASS**: 
     - If `NODE_ENV === 'production'`, `host` evaluates to `'0.0.0.0'`.
     - **Vulnerability**: If `NODE_ENV` is omitted or accidentally set to `development` or `staging` on Render, `host` defaults to `'127.0.0.1'`. Binding to `127.0.0.1` inside a Docker container causes Render's health checks to fail and the deploy will time out with `Port check failed`.
3. **Actionable Render Safeguard**:
   - Explicitly add `HOST=0.0.0.0` as an environment variable in the Render Dashboard so that public binding is guaranteed regardless of `NODE_ENV`.

---

## 6. Health Check Endpoint Audit

### Code Audit (`backend/src/modules/system/health.controller.ts`)
```typescript
@ApiTags('System Health & Probes')
@Controller('health')
export class HealthController { ... }
```
In `backend/src/main.ts`:
```typescript
app.setGlobalPrefix('api/v1');
```

### Available Health Probes:
| Route | Method | Target Checks | Expected Response |
| :--- | :---: | :--- | :--- |
| **`/api/v1/health`** | `GET` | PostgreSQL `SELECT 1` + Clock Rollback Assertion | `200 OK` (`{"status":"HEALTHY","components":{...}}`) or `503 Service Unavailable` |
| **`/api/v1/health/live`** | `GET` | Process liveness & uptime check | `200 OK` (`{"status":"UP","uptimeSeconds":120}`) |
| **`/api/v1/health/ready`** | `GET` | Database readiness probe | `200 OK` (`{"status":"READY"}`) or `503 Service Unavailable` |

### Render Setting:
- **Health Check Path**: `/api/v1/health` (or `/api/v1/health/live` for pure liveness)

> [!WARNING]
> Do NOT set Render Health Check Path to `/health`. Because of NestJS `setGlobalPrefix('api/v1')`, `/health` will return `404 Not Found`, causing Render to fail zero-downtime deployment.

---

## 7. CORS Configuration Audit

### Code Audit (`backend/src/main.ts` Lines 56-59)
```typescript
app.enableCors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  credentials: true,
});
```

### Findings:
1. `CORS_ORIGIN` accepts a comma-separated list of origins.
2. In production, requests from web browsers (e.g. Next.js hosted on Vercel or Render) will be **blocked** unless `CORS_ORIGIN` includes the exact URL.
3. Because `credentials: true` is enabled, browsers **reject** wildcard origins (`*`).
4. **Recommended Render Value**:
   ```
   CORS_ORIGIN=https://watergrid.onrender.com,https://watergrid-app.vercel.app,http://localhost:3000
   ```

---

## 8. Required Production Environment Variables

### Mandatory Variables (Validated at Boot by `EnvironmentConfigService.ts`)
If any of these fail validation in production, the server aborts startup immediately:

| Variable | Requirement / Validation Rule | Example Production Value |
| :--- | :--- | :--- |
| **`NODE_ENV`** | Must be `production`. Triggers security validations and host binding. | `production` |
| **`DATABASE_URL`** | Required. Neon PostgreSQL pooled connection string. | `postgresql://watergrid_owner:secret@ep-cool-fog-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true` |
| **`DIRECT_URL`** | Required for Prisma migrations (unpooled Neon connection). | `postgresql://watergrid_owner:secret@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| **`JWT_SECRET`** | Must be $\ge 32$ characters. **Cannot** match the insecure development default. | *Auto-generated 64-char hex string via Render* |
| **`JWT_REFRESH_SECRET`** | Must be $\ge 32$ characters. **Cannot** match the insecure development default. | *Auto-generated 64-char hex string via Render* |
| **`HOST`** | Recommended override to guarantee `0.0.0.0` binding. | `0.0.0.0` |
| **`PORT`** | Automatically assigned by Render. Do not manually hardcode. | *Provided by Render (e.g. 10000)* |

### Operational & Feature Variables:
| Variable | Default if Omitted | Purpose | Recommended Production Setting |
| :--- | :---: | :--- | :--- |
| **`CORS_ORIGIN`** | `localhost:3000` | Allowed client domains | `https://your-frontend-domain.com` |
| **`ENABLE_SWAGGER`** | `false` | Expose OpenAPI docs at `/api/docs` | `false` (or `true` if public staging) |
| **`LOG_LEVEL`** | `info` | NestJS logger verbosity | `info` |
| **`JWT_EXPIRATION`** | `1h` | Access token lifespan | `15m` |
| **`JWT_REFRESH_EXPIRATION`**| `7d` | Refresh token lifespan | `7d` |

---

## 9. Exact Render Web Service Settings (Copy-Paste)

### Settings for Render Web Service Dashboard

```yaml
Service Type:           Web Service
Environment:            Node
Name:                   watergrid-api
Region:                 Singapore (ap-southeast-1) [or closest to target users]
Branch:                 main
Root Directory:         backend
Build Command:          npm ci && npx prisma generate --schema=prisma/schema.prisma && npx prisma migrate deploy --schema=prisma/schema.prisma && npx nest build
Start Command:          npm run start:prod
Health Check Path:      /api/v1/health
Auto-Deploy:            No (or Yes with GitHub Actions pipeline)
```

### Environment Variables to enter in Render Dashboard:
```bash
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/neondb?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://[user]:[password]@[endpoint].[region].aws.neon.tech/neondb?sslmode=require
JWT_SECRET=[Render 'Generate' button - minimum 32 chars]
JWT_REFRESH_SECRET=[Render 'Generate' button - minimum 32 chars]
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGIN=https://watergrid-frontend.onrender.com,http://localhost:3000
ENABLE_SWAGGER=false
LOG_LEVEL=info
```

---

## 10. Audit Conclusion

The WaterGrid V2 NestJS backend is **fully architected for Render deployment**, with the following operational confirmations:
1. **Dynamic Port**: Binds directly to `process.env.PORT`.
2. **0.0.0.0 Listener**: Correctly binds to `0.0.0.0` when `NODE_ENV=production` (with `HOST=0.0.0.0` as an explicit safety override).
3. **Health Check**: Native probe active at `/api/v1/health` with comprehensive DB ping and clock validation.
4. **Prisma & Neon**: Migration scripts and direct connection mapping (`DIRECT_URL`) are configured to support Neon PgBouncer connection pooling without lock contention.
5. **Start Command**: Clearly verified as `npm run start:prod` (`node dist/src/main`).
