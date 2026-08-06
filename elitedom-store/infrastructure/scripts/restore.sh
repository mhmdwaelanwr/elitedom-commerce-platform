#!/bin/bash
# =============================================================================
# Elitedom Store — Database Restore Script
# Per 17_DISASTER_RECOVERY/RESTORE_PROCEDURES.md
#
# Usage: restore.sh <backup_file.sql.gz> <app|odoo>
# =============================================================================

set -euo pipefail

BACKUP_FILE="${1:?Usage: restore.sh <backup_file.sql.gz> <app|odoo>}"
TARGET="${2:?Usage: restore.sh <backup_file.sql.gz> <app|odoo>}"
DB_USER="${POSTGRES_USER:-elitedom}"
DB_HOST="${POSTGRES_HOST:-postgres}"

case "${TARGET}" in
    app)
        DB_NAME="${APP_POSTGRES_DB:-elitedom_store}"
        ;;
    odoo)
        DB_NAME="${ODOO_DB:-${POSTGRES_DB:-elitedom_db}}"
        ;;
    *)
        echo "Target must be 'app' or 'odoo'." >&2
        exit 2
        ;;
esac

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

gzip -t "${BACKUP_FILE}"

echo "WARNING: this will overwrite the ${TARGET} database '${DB_NAME}'."
echo "Backup file: ${BACKUP_FILE}"
read -r -p "Type the target database name (${DB_NAME}) to continue: " CONFIRM

if [ "${CONFIRM}" != "${DB_NAME}" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Restoring ${TARGET} database from: ${BACKUP_FILE}"
gunzip -c "${BACKUP_FILE}" | psql -v ON_ERROR_STOP=1 -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}"
echo "Database restored successfully."
