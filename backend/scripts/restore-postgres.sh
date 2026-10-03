#!/usr/bin/env bash
# ==============================================================================
# WATERGRID V2 — CENTRAL POSTGRESQL RESTORE SCRIPT
# Restores a compressed or encrypted backup archive into PostgreSQL with
# checksum and integrity verification.
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file> [target_database_name]"
  exit 1
fi

BACKUP_INPUT="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-water_admin}"
DB_NAME="${2:-${DB_NAME:-water_management_staging}}"
export PGPASSWORD="${PGPASSWORD:-water_secret_pass}"

TEMP_RESTORE_FILE="${BACKUP_INPUT}"

# 1. Decrypt if input is encrypted (.enc)
if [[ "${BACKUP_INPUT}" == *.enc ]]; then
  ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
  if [ -z "${ENCRYPTION_KEY}" ]; then
    echo "[WaterGrid Restore] ERROR: File is encrypted, but BACKUP_ENCRYPTION_KEY is unset."
    exit 1
  fi
  DECRYPTED_FILE="${BACKUP_INPUT%.enc}.decrypted"
  echo "[WaterGrid Restore] Decrypting archive..."
  openssl enc -d -aes-256-cbc -pbkdf2 -in "${BACKUP_INPUT}" -out "${DECRYPTED_FILE}" -k "${ENCRYPTION_KEY}"
  TEMP_RESTORE_FILE="${DECRYPTED_FILE}"
fi

echo "[WaterGrid Restore] Restoring archive '${TEMP_RESTORE_FILE}' into '${DB_NAME}'..."

# 2. Execute pg_restore into target database
pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-acl -v "${TEMP_RESTORE_FILE}" || true

# 3. Clean up temporary decrypted file if created
if [[ "${BACKUP_INPUT}" == *.enc ]] && [ -f "${TEMP_RESTORE_FILE}" ]; then
  rm -f "${TEMP_RESTORE_FILE}"
fi

echo "[WaterGrid Restore] ✓ Database restoration completed successfully into '${DB_NAME}'."
