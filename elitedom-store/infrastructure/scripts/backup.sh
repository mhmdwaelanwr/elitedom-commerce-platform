#!/bin/bash
# =============================================================================
# Elitedom Store — Database Backup Script
# Per 17_DISASTER_RECOVERY/BACKUP_STRATEGY.md
#
# The Odoo ERP schema and the Store API schema intentionally live in separate
# PostgreSQL databases.  A recoverable backup must include both.
# =============================================================================

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_USER="${POSTGRES_USER:-elitedom}"
DB_HOST="${POSTGRES_HOST:-postgres}"
ODOO_DB="${ODOO_DB:-${POSTGRES_DB:-elitedom_db}}"
APP_DB="${APP_POSTGRES_DB:-elitedom_store}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [ "${ODOO_DB}" = "${APP_DB}" ]; then
    echo "Refusing backup: ODOO_DB and APP_POSTGRES_DB must be different." >&2
    exit 1
fi

mkdir -p "${BACKUP_DIR}"

backup_database() {
    local database_name="$1"
    local database_kind="$2"
    local backup_file="${BACKUP_DIR}/elitedom_${TIMESTAMP}_${database_kind}.sql.gz"
    local temporary_file

    temporary_file=$(mktemp "${BACKUP_DIR}/.${database_kind}_${TIMESTAMP}.XXXXXX")
    trap 'rm -f "${temporary_file:-}"' RETURN

    echo "Starting ${database_kind} database backup: ${backup_file}"
    pg_dump --no-owner --no-privileges -h "${DB_HOST}" -U "${DB_USER}" -d "${database_name}" \
        | gzip -9 > "${temporary_file}"
    gzip -t "${temporary_file}"
    mv "${temporary_file}" "${backup_file}"
    trap - RETURN

    local size
    size=$(du -h "${backup_file}" | cut -f1)
    echo "Completed ${database_kind} backup: ${backup_file} (${size})"
}

backup_database "${ODOO_DB}" "odoo"
backup_database "${APP_DB}" "app"

find "${BACKUP_DIR}" -type f -name "elitedom_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "Removed backups older than ${RETENTION_DAYS} days."
