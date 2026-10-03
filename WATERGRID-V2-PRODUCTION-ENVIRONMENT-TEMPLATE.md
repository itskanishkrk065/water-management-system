# WATERGRID V2 — PRODUCTION ENVIRONMENT TEMPLATE
**Authoritative Environment Variable Reference, Entropy Specifications, and Security Directives**

---

## 1. PRODUCTION ENVIRONMENT TEMPLATE (`.env.production`)

```ini
# ==============================================================================
# WATERGRID V2 — PRODUCTION CONFIGURATION
# Copy to /opt/watergrid/backend/.env.production and set permissions to 0600.
# NEVER commit the filled version of this file into version control.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. RUNTIME ENVIRONMENT
# ------------------------------------------------------------------------------
NODE_ENV=production
PORT=4000
HOST=127.0.0.1

# ------------------------------------------------------------------------------
# 2. AUTHORITATIVE POSTGRESQL DATABASE CONNECTIONS
# ------------------------------------------------------------------------------
# Runtime Application User (Least Privilege: DML Only)
DATABASE_URL=postgresql://water_app:REPLACE_WITH_SECURE_APP_PASSWORD@127.0.0.1:5432/water_management_prod?schema=public&connection_limit=25&pool_timeout=10

# Master Migration User (Used only by prisma migrate deploy)
DATABASE_URL_MIGRATION=postgresql://water_admin:REPLACE_WITH_SECURE_ADMIN_PASSWORD@127.0.0.1:5432/water_management_prod?schema=public

# ------------------------------------------------------------------------------
# 3. REDIS DISTRIBUTED CACHE & LOCKING (OPTIONAL)
# ------------------------------------------------------------------------------
REDIS_URL=redis://:REPLACE_WITH_STRONG_REDIS_PASSWORD@127.0.0.1:6379

# ------------------------------------------------------------------------------
# 4. CRYPTOGRAPHIC SECRETS (HIGH ENTROPY MANDATORY)
# Generate each secret using: openssl rand -base64 48
# ------------------------------------------------------------------------------
# Minimum 64 characters. Never use default development string.
JWT_SECRET=REPLACE_WITH_OUTPUT_OF_OPENSSL_RAND_BASE64_48_KEY1_MIN_64_CHARS
JWT_REFRESH_SECRET=REPLACE_WITH_OUTPUT_OF_OPENSSL_RAND_BASE64_48_KEY2_MIN_64_CHARS

# Token Lifespan
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# AES-256 Symmetric Key for Central & Local Backup Encryption
BACKUP_ENCRYPTION_KEY=REPLACE_WITH_OUTPUT_OF_OPENSSL_RAND_BASE64_32_FOR_BACKUP_AES256

# ------------------------------------------------------------------------------
# 5. CROSS-ORIGIN RESOURCE SHARING (CORS)
# Comma-separated list of fully qualified allowed client origins.
# ------------------------------------------------------------------------------
CORS_ORIGIN=https://watergrid.kongu.gov.in,http://localhost:3000

# ------------------------------------------------------------------------------
# 6. S3 DOCUMENT STORAGE (GOVERNMENT CLOUD OBJECT STORE)
# ------------------------------------------------------------------------------
S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
S3_ACCESS_KEY=REPLACE_WITH_IAM_ACCESS_KEY
S3_SECRET_KEY=REPLACE_WITH_IAM_SECRET_KEY
S3_BUCKET=watergrid-documents-prod
S3_REGION=ap-south-1

# ------------------------------------------------------------------------------
# 7. OBSERVABILITY, LOGGING & COMPLIANCE
# ------------------------------------------------------------------------------
LOG_LEVEL=info
ENABLE_SWAGGER=false
AUDIT_LOG_RETENTION_DAYS=2555  # 7 Years statutory compliance
```

---

## 2. KEY GENERATION CHEAT SHEET

Execute the following commands on the secure deployment host to generate production-grade cryptographic secrets:

```bash
# Generate JWT_SECRET (48 bytes base64 = 64 characters)
openssl rand -base64 48

# Generate JWT_REFRESH_SECRET (48 bytes base64 = 64 characters)
openssl rand -base64 48

# Generate BACKUP_ENCRYPTION_KEY (32 bytes base64 = 44 characters)
openssl rand -base64 32

# Generate Database Password (24 bytes hex = 48 characters)
openssl rand -hex 24
```

---

## 3. FILE SYSTEM PERMISSIONS & SECURITY DIRECTIVES

```bash
# 1. Place file in backend configuration directory
sudo chown ubuntu:ubuntu /opt/watergrid/backend/.env.production

# 2. Restrict permissions to read/write by owner only
chmod 600 /opt/watergrid/backend/.env.production

# 3. Verify git ignores this file
git check-ignore /opt/watergrid/backend/.env.production
# Output should return: /opt/watergrid/backend/.env.production
```
