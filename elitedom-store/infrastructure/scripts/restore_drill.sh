#!/usr/bin/env bash
# Restore both Elitedom PostgreSQL backups into an isolated disposable container.
# The live Compose project, live databases, .env, and persistent volumes are never used.

set -Eeuo pipefail

APP_BACKUP="${1:?Usage: restore_drill.sh <app-backup.sql.gz> <odoo-backup.sql.gz>}"
ODOO_BACKUP="${2:?Usage: restore_drill.sh <app-backup.sql.gz> <odoo-backup.sql.gz>}"
POSTGRES_IMAGE="${RESTORE_DRILL_POSTGRES_IMAGE:-postgres:15-alpine}"

for command_name in docker gzip awk; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "ERROR: $command_name is required" >&2
    exit 1
  }
done

docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker daemon is unavailable to the current user" >&2
  exit 1
}

for backup in "$APP_BACKUP" "$ODOO_BACKUP"; do
  [[ -f "$backup" && ! -L "$backup" ]] || {
    echo "ERROR: backup must be a regular non-symlink file: $backup" >&2
    exit 1
  }
  gzip -t "$backup"
done

echo "Backup gzip integrity checks passed."

suffix="${RANDOM}-$$-$(date +%s)"
container="elitedom-restore-drill-${suffix}"
volume="elitedom-restore-drill-${suffix}"
password=""
if command -v openssl >/dev/null 2>&1; then
  password="$(openssl rand -hex 24)"
else
  password="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
fi

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker volume create "$volume" >/dev/null

docker run -d \
  --name "$container" \
  --network none \
  -e POSTGRES_USER=drill \
  -e POSTGRES_PASSWORD="$password" \
  -e POSTGRES_DB=postgres \
  -v "$volume:/var/lib/postgresql/data" \
  "$POSTGRES_IMAGE" >/dev/null

echo "Started isolated PostgreSQL restore target with no published ports or live mounts."

ready=false
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U drill -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == "true" ]] || {
  echo "ERROR: isolated PostgreSQL did not become ready" >&2
  exit 1
}

APP_DB="elitedom_restore_drill_app"
ODOO_DB="elitedom_restore_drill_odoo"
docker exec "$container" createdb -U drill "$APP_DB"
docker exec "$container" createdb -U drill "$ODOO_DB"

echo "Restoring application backup into isolated database..."
gzip -dc "$APP_BACKUP" | docker exec -i "$container" \
  psql -v ON_ERROR_STOP=1 -U drill -d "$APP_DB" >/dev/null

echo "Restoring Odoo backup into isolated database..."
gzip -dc "$ODOO_BACKUP" | docker exec -i "$container" \
  psql -v ON_ERROR_STOP=1 -U drill -d "$ODOO_DB" >/dev/null

count_tables() {
  local database="$1"
  docker exec "$container" psql -At -U drill -d "$database" -c \
    "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');" \
    | tr -d '\r\n'
}

app_tables="$(count_tables "$APP_DB")"
odoo_tables="$(count_tables "$ODOO_DB")"
[[ "$app_tables" =~ ^[0-9]+$ && "$app_tables" -gt 0 ]] || {
  echo "ERROR: application restore produced no user tables" >&2
  exit 1
}
[[ "$odoo_tables" =~ ^[0-9]+$ && "$odoo_tables" -gt 0 ]] || {
  echo "ERROR: Odoo restore produced no user tables" >&2
  exit 1
}

docker exec "$container" psql -v ON_ERROR_STOP=1 -U drill -d "$APP_DB" -c 'SELECT 1;' >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U drill -d "$ODOO_DB" -c 'SELECT 1;' >/dev/null

printf 'Restore drill passed: app tables=%s, Odoo tables=%s.\n' "$app_tables" "$odoo_tables"
echo "The isolated container and temporary volume will now be removed."
