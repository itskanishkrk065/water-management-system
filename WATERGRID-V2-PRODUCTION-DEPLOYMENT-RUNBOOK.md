# WATERGRID V2 — PRODUCTION DEPLOYMENT RUNBOOK
**Authoritative Operational Runbook for Central Server Deployment, Schema Provisioning, and Infrastructure Hardening**

---

## 1. INFRASTRUCTURE & PREREQUISITES

### Host System Requirements
* **Operating System**: Ubuntu 22.04 LTS (Jammy Jellyfish) or Debian 12 (Bookworm).
* **CPU**: Minimum 4 vCPUs (8 vCPUs recommended for multi-district operations).
* **Memory**: Minimum 8 GB RAM (16 GB ECC RAM recommended).
* **Disk**: 100 GB NVMe SSD mounted at `/opt/watergrid` (with hourly snapshots).
* **Network**: Dual network interfaces (Public WAN for TLS ingress; Private LAN/VPC for PostgreSQL and Redis).

### Software Dependencies
* **Node.js**: `v20.18.0` LTS (Iron).
* **Package Manager**: `npm` v10.8+.
* **Database**: PostgreSQL `16.2+` (Alpine or standard distribution).
* **Reverse Proxy**: Nginx `1.24+` with OpenSSL 3.0+.
* **Process Manager**: PM2 `5.3+` or native `systemd`.

---

## 2. DATABASE PROVISIONING & USER PRIVILEGES (LEAST PRIVILEGE)

Never run the application server as the PostgreSQL superuser. Create two distinct database users:
1. `water_admin`: Used strictly for schema provisioning, migrations (`prisma migrate deploy`), and database administrative audits.
2. `water_app`: Used for application runtime with strict DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on application tables.

```sql
-- Connect as postgres superuser:
CREATE DATABASE water_management_prod;

-- 1. Create migration/admin user
CREATE USER water_admin WITH ENCRYPTED PASSWORD 'REPLACE_WITH_SUPER_SECURE_ADMIN_PASS';
GRANT ALL PRIVILEGES ON DATABASE water_management_prod TO water_admin;

-- 2. Create least-privilege application runtime user
CREATE USER water_app WITH ENCRYPTED PASSWORD 'REPLACE_WITH_SUPER_SECURE_APP_PASS';
GRANT CONNECT ON DATABASE water_management_prod TO water_app;

-- Connect to water_management_prod:
\c water_management_prod

-- Grant schema usage
GRANT USAGE, CREATE ON SCHEMA public TO water_admin;
GRANT USAGE ON SCHEMA public TO water_app;

-- Grant DML table permissions to water_app
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO water_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO water_app;
```

---

## 3. STEP-BY-STEP PRODUCTION DEPLOYMENT PROCEDURE

### Step 1: Clone Verified Release Baseline
```bash
# Create application root directory
sudo mkdir -p /opt/watergrid
sudo chown -R ubuntu:ubuntu /opt/watergrid
cd /opt/watergrid

# Clone authoritative repository
git clone https://github.com/itskanishkrk065/water-management-system.git .

# Check out verified baseline release tag
git checkout v2.0-staging-verified
```

### Step 2: Configure Production Environment Variables
Create `/opt/watergrid/backend/.env.production` (permissions `0600`):
```bash
cat << 'EOF' > /opt/watergrid/backend/.env.production
NODE_ENV=production
PORT=4000
HOST=127.0.0.1

# Production PostgreSQL Database URL (Connection pooling configured)
DATABASE_URL=postgresql://water_app:REPLACE_WITH_SUPER_SECURE_APP_PASS@127.0.0.1:5432/water_management_prod?schema=public&connection_limit=25&pool_timeout=10

# Master Migration Database URL (Used by Prisma migrate deploy)
DATABASE_URL_MIGRATION=postgresql://water_admin:REPLACE_WITH_SUPER_SECURE_ADMIN_PASS@127.0.0.1:5432/water_management_prod?schema=public

# High-Entropy JWT Secrets (Minimum 64 characters)
JWT_SECRET=SECURE_RANDOM_GENERATED_JWT_SECRET_STRING_MINIMUM_64_CHARACTERS_LONG_001
JWT_REFRESH_SECRET=SECURE_RANDOM_GENERATED_JWT_REFRESH_SECRET_STRING_MINIMUM_64_CHARACTERS_LONG_002
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Encryption Key for Central & Local Backups
BACKUP_ENCRYPTION_KEY=SECURE_AES256_BACKUP_ENCRYPTION_KEY_MINIMUM_32_CHARACTERS

# CORS Configuration (Restricted to verified frontend hostnames)
CORS_ORIGIN=https://watergrid.kongu.gov.in,http://localhost:3000

# Observability
LOG_LEVEL=info
ENABLE_SWAGGER=false
EOF

chmod 600 /opt/watergrid/backend/.env.production
```

### Step 3: Install Production Dependencies & Build Bundles
```bash
cd /opt/watergrid/backend

# Install exact lockfile dependencies
npm ci --production=false

# Generate Prisma Client for PostgreSQL
npx prisma generate --schema=prisma/schema.prisma

# Build production distribution bundle
npm run build
```

### Step 4: Execute Deterministic Schema Migrations
```bash
# Apply versioned baseline migration using migration user
DATABASE_URL="$DATABASE_URL_MIGRATION" npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Step 5: Historical Data Migration (First-Time Provisioning Only)
If seeding baseline master data and migrating historical SQLite records:
```bash
DATABASE_URL_POSTGRES="$DATABASE_URL_MIGRATION" npx ts-node scripts/migrate-sqlite-to-postgres.ts
```

### Step 6: Configure Systemd Service Unit
Create `/etc/systemd/system/watergrid-backend.service`:
```ini
[Unit]
Description=WaterGrid V2 Central Monolith API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/watergrid/backend
EnvironmentFile=/opt/watergrid/backend/.env.production
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=watergrid-backend

# Security Sandboxing
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Reload systemd and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable watergrid-backend
sudo systemctl start watergrid-backend
sudo systemctl status watergrid-backend
```

---

## 4. NGINX REVERSE PROXY & TLS CONFIGURATION

Create `/etc/nginx/sites-available/watergrid.conf`:
```nginx
upstream watergrid_api {
    server 127.0.0.1:4000;
    keepalive 32;
}

server {
    listen 80;
    server_name watergrid.kongu.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name watergrid.kongu.gov.in;

    ssl_certificate /etc/letsencrypt/live/watergrid.kongu.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watergrid.kongu.gov.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Request Body Size Limit (Allow Excel & Document uploads)
    client_max_body_size 25M;

    # API Proxy
    location /api/ {
        proxy_pass http://watergrid_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Health Check Probe (Bypass access logging)
    location /api/v1/health {
        proxy_pass http://watergrid_api;
        access_log off;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/watergrid.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. POST-DEPLOYMENT SMOKE TESTS

Execute the automated verification sequence against the production URL:
```bash
# 1. Verify Health Endpoint
curl -sf https://watergrid.kongu.gov.in/api/v1/health | jq .
# Expected Output: { "status": "HEALTHY", "components": { "database": { "status": "UP" } } }

# 2. Verify Liveness Probe
curl -sf https://watergrid.kongu.gov.in/api/v1/health/live | jq .
# Expected Output: { "status": "UP" }

# 3. Verify Security Headers
curl -I https://watergrid.kongu.gov.in/api/v1/health
# Verify presence of X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
```
