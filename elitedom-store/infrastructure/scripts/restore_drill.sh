#!/usr/bin/env bash
# Elitedom Store — Isolated backup restore drill.
# Tests backup recoverability WITHOUT touching live databases.
# Usage: restore_drill.sh [repo-path] [backup-dir]

set -Eeuo pipefail

REPO_PATH="${1:-/opt/elitedom}"
BACKUP_DIR="${2:-$(dirname "$REPO_PATH")/elitedom-backups}"
STORE_PATH="$REPO_PATH/elitedom-store"
INFRA_PATH="$STORE_PATH/infrastructure"
ENV_FILE="$STORE_PATH/.env"
DRILL_DB_PREFIX="drill_"
DRILL_CONTAINER="elitedom-restore-drill"
FAILURES=0

fail() { printf '\033[31mFAIL:\033[0m %s\n' "$*" >&2; FAILURES=$((FAILURES + 1)); }
pass() { printf '\033[32mPASS:\033[0m %s\n' "$*"; }
info() { printf '\033[36mINFO:\033[0m %s\n' "$*"; }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }

cleanup() {
  info "Cleaning up drill artifacts..."
  docker rm -f "$DRILL_CONTAINER" 2>/dev/null || true
  # Drop drill databases if the container left them behind
  if docker ps --format '{{.Names}}' | grep -q "^elitedom-postgres$"; then
    docker exec elitedom-postgres sh -c \
      "psql -U \"\$POSTGRES_USER\" -d postgres -c \"DROP DATABASE IF EXISTS ${DRILL_DB_PREFIX}app;\"" 2>/dev/null || true
    docker exec elitedom-postgres sh -c \
      "psql -U \"\$POSTGRES_USER\" -d postgres -c \"DROP DATABASE IF EXISTS ${DRILL_DB_PREFIX}odoo;\"" 2>/dev/null || true
  fi
  info "Drill cleanup complete."
}
trap cleanup EXIT

section "Pre-flight Checks"
[[ -f "$ENV_FILE" ]] || { fail ".env file not found at $ENV_FILE"; exit 1; }
[[ -d "$BACKUP_DIR" ]] || { fail "Backup directory not found at $BACKUP_DIR"; exit 1; }

LATEST_APP_BACKUP="$(ls -t "$BACKUP_DIR"/elitedom_*_app.sql.gz 2>/dev/null | head -1 || true)"
LATEST_ODOO_BACKUP="$(ls -t "$BACKUP_DIR"/elitedom_*_odoo.sql.gz 2>/dev/null | head -1 || true)"

if [[ -z "$LATEST_APP_BACKUP" ]]; then
  fail "No application backup found in $BACKUP_DIR"
  exit 1
fi
pass "Latest app backup: $(basename "$LATEST_APP_BACKUP")"

if [[ -z "$LATEST_ODOO_BACKUP" ]]; then
  info "No Odoo backup found — will skip Odoo drill"
fi

section "Backup Integrity"
if gzip -t "$LATEST_APP_BACKUP" 2>/dev/null; then
  APP_SIZE="$(du -h "$LATEST_APP_BACKUP" | cut -f1)"
  pass "App backup integrity OK ($APP_SIZE)"
else
  fail "App backup is corrupted: $LATEST_APP_BACKUP"
  exit 1
fi

if [[ -n "$LATEST_ODOO_BACKUP" ]]; then
  if gzip -t "$LATEST_ODOO_BACKUP" 2>/dev/null; then
    ODOO_SIZE="$(du -h "$LATEST_ODOO_BACKUP" | cut -f1)"
    pass "Odoo backup integrity OK ($ODOO_SIZE)"
  else
    fail "Odoo backup is corrupted: $LATEST_ODOO_BACKUP"
    exit 1
  fi
fi

section "Isolated Restore to Drill Databases"
POSTGRES_CONTAINER="elitedom-postgres"
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  fail "PostgreSQL container '$POSTGRES_CONTAINER' is not running"
  exit 1
fi

info "Creating drill databases..."
docker exec "$POSTGRES_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c \"CREATE DATABASE ${DRILL_DB_PREFIX}app;\"" 2>/dev/null || true
docker exec "$POSTGRES_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c \"CREATE DATABASE ${DRILL_DB_PREFIX}odoo;\"" 2>/dev/null || true

info "Restoring app backup to drill database..."
gunzip -c "$LATEST_APP_BACKUP" | docker exec -i "$POSTGRES_CONTAINER" \
  psql -U "\$POSTGRES_USER" -d "${DRILL_DB_PREFIX}app" -q 2>/dev/null
APP_RESTORED="$?"
if [[ "$APP_RESTORED" -eq 0 ]]; then
  pass "App backup restored to ${DRILL_DB_PREFIX}app"
else
  fail "App backup restore failed"
fi

if [[ -n "$LATEST_ODOO_BACKUP" ]]; then
  info "Restoring Odoo backup to drill database..."
  gunzip -c "$LATEST_ODOO_BACKUP" | docker exec -i "$POSTGRES_CONTAINER" \
    psql -U "\$POSTGRES_USER" -d "${DRILL_DB_PREFIX}odoo" -q 2>/dev/null
  ODOO_RESTORED="$?"
  if [[ "$ODOO_RESTORED" -eq 0 ]]; then
    pass "Odoo backup restored to ${DRILL_DB_PREFIX}odoo"
  else
    fail "Odoo backup restore failed"
  fi
fi

section "Integrity Checks"
APP_TABLES="$(docker exec "$POSTGRES_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d ${DRILL_DB_PREFIX}app -At -c \
    \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\"" 2>/dev/null || echo 0)"
if [[ "$APP_TABLES" -gt 0 ]]; then
  pass "App drill database has $APP_TABLES tables"
else
  fail "App drill database has no tables"
fi

if [[ -n "$LATEST_ODOO_BACKUP" ]]; then
  ODOO_TABLES="$(docker exec "$POSTGRES_CONTAINER" sh -c \
    "psql -U \"\$POSTGRES_USER\" -d ${DRILL_DB_PREFIX}odoo -At -c \
      \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\"" 2>/dev/null || echo 0)"
  if [[ "$ODOO_TABLES" -gt 0 ]]; then
    pass "Odoo drill database has $ODOO_TABLES tables"
  else
    fail "Odoo drill database has no tables"
  fi
fi

section "Drill Summary"
if [[ $FAILURES -eq 0 ]]; then
  pass "Restore drill completed successfully — backup is recoverable"
  exit 0
else
  fail "Restore drill failed ($FAILURES failures)"
  exit 1
fi
