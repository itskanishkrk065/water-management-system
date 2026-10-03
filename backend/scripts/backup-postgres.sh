#!/usr/bin/env bash
# ==============================================================================
# WATERGRID V2 — CENTRAL POSTGRESQL BACKUP SCRIPT
# Creates an authenticated, compressed, checksummed, and optionally encrypted
# backup archive of the authoritative PostgreSQL central database.
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-water_admin}"
DB_NAME="${DB_NAME:-water_management_staging}"
export PGPASSWORD="${PGPASSWORD:-water_secret_pass}"

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BASE="watergrid_backup_${DB_NAME}_${TIMESTAMP}"
DUMP_FILE="${BACKUP_DIR}/${BACKUP_BASE}.dump"
CHECKSUM_FILE="${BACKUP_DIR}/${BACKUP_BASE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[WaterGrid Backup] Starting PostgreSQL backup for '${DB_NAME}' at ${TIMESTAMP}..."

# 1. Execute pg_dump (Custom compressed format)
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v -f "${DUMP_FILE}"

# 2. Compute SHA-256 Checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${DUMP_FILE}" > "${CHECKSUM_FILE}"
else
  shasum -a 256 "${DUMP_FILE}" > "${CHECKSUM_FILE}"
fi

FILE_SIZE=$(ls -lh "${DUMP_FILE}" | awk '{print $5}')
echo "[WaterGrid Backup] ✓ Dump created: ${DUMP_FILE} (${FILE_SIZE})"
echo "[WaterGrid Backup] ✓ Checksum saved: ${CHECKSUM_FILE}"

# 3. Optional AES-256 Encryption
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
if [ -n "${ENCRYPTION_KEY}" ]; then
  ENC_FILE="${DUMP_FILE}.enc"
  echo "[WaterGrid Backup] Encrypting archive with AES-256-CBC..."
  openssl enc -aes-256-cbc -salt -pbkdf2 -in "${DUMP_FILE}" -out "${ENC_FILE}" -k "${ENCRYPTION_KEY}"
  rm -f "${DUMP_FILE}"
  echo "[WaterGrid Backup] ✓ Encrypted archive created: ${ENC_FILE}"
fi

echo "[WaterGrid Backup] Backup operation completed successfully."
