#!/usr/bin/env bash
# Deploy one immutable Elitedom release on the existing single-VPS Compose host.
# This script never restores/downgrades databases automatically on failure.

set -Eeuo pipefail

RELEASE_REF="${1:?Usage: deploy_release.sh <40-char-sha> <repo-path> <site-origin> <api-origin>}"
REPO_PATH="${2:?Missing repo path}"
SITE_URL="${3:?Missing site origin}"
API_URL="${4:?Missing API origin}"

fail() { echo "ERROR: $*" >&2; exit 1; }
[[ "$RELEASE_REF" =~ ^[0-9a-fA-F]{40}$ ]] || fail "release ref must be a full 40-character Git SHA"
[[ "$REPO_PATH" = /* ]] || fail "deployment path must be absolute"
[[ "$SITE_URL" =~ ^https://[^/]+/?$ ]] || fail "site URL must be a credential-free HTTPS origin"
[[ "$API_URL" =~ ^https://[^/]+/?$ ]] || fail "API URL must be a credential-free HTTPS origin"

command -v git >/dev/null || fail "git is required"
command -v docker >/dev/null || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"
docker compose wait --help >/dev/null 2>&1 || fail "Docker Compose must support the wait command"
command -v gzip >/dev/null || fail "gzip is required"

cd "$REPO_PATH"
[[ -d .git ]] || fail "deployment path is not a Git repository"
origin="$(git config --get remote.origin.url || true)"
[[ "$origin" == *"mhmdwaelanwr/elitedom-erp-architecture"* ]] || fail "unexpected Git origin"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked deployment checkout has local changes"

previous_ref="$(git rev-parse HEAD)"
echo "Previous release: $previous_ref"
echo "Requested release: $RELEASE_REF"

git fetch --prune origin main
git cat-file -e "${RELEASE_REF}^{commit}" || fail "release commit does not exist"
git merge-base --is-ancestor "$RELEASE_REF" origin/main || fail "release is not reachable from origin/main"
git checkout --detach "$RELEASE_REF"

ENV_FILE="$REPO_PATH/elitedom-store/.env"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail "production .env is missing or is a symlink"
permissions="$(stat -c '%a' "$ENV_FILE")"
case "$permissions" in 600|640) ;; *) fail "production .env permissions must be 600 or 640 (found $permissions)" ;; esac

export RELEASE_REF
export VITE_SITE_URL="${SITE_URL%/}"
export VITE_API_URL="${API_URL%/}/api/v1"

STORE="$REPO_PATH/elitedom-store"
INFRA="$STORE/infrastructure"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$INFRA/docker-compose.yml" -f "$INFRA/docker-compose.prod.yml")

"${COMPOSE[@]}" config --quiet

echo "Ensuring PostgreSQL and the one-shot app DB initializer complete before backup..."
"${COMPOSE[@]}" up -d postgres app-db-init
"${COMPOSE[@]}" wait app-db-init
"${COMPOSE[@]}" exec -T postgres sh -ec 'pg_isready -U "$POSTGRES_USER" -d postgres'

BACKUP_DIR="${DEPLOY_BACKUP_DIR:-$(dirname "$REPO_PATH")/elitedom-backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

postgres_env() {
  "${COMPOSE[@]}" exec -T postgres printenv "$1" | tr -d '\r\n'
}
DB_USER="$(postgres_env POSTGRES_USER)"
APP_DB="$(postgres_env APP_POSTGRES_DB)"
ODOO_DB="$("${COMPOSE[@]}" run --rm --no-deps --entrypoint /bin/sh odoo -ec 'printf %s "$ODOO_DB"' | tr -d '\r\n')"
[[ -n "$DB_USER" && -n "$APP_DB" && -n "$ODOO_DB" ]] || fail "database identity could not be resolved"
[[ "$APP_DB" != "$ODOO_DB" ]] || fail "application and Odoo databases must be distinct"

backup_db() {
  local db="$1" kind="$2" out="$BACKUP_DIR/elitedom_${timestamp}_${kind}.sql.gz" tmp="${out}.partial"
  if ! "${COMPOSE[@]}" exec -T postgres sh -ec 'psql -At -U "$POSTGRES_USER" -d postgres -c "SELECT datname FROM pg_database WHERE datistemplate = false"' | grep -Fxq "$db"; then
    echo "No pre-existing $kind database '$db'; recording first-deploy state."
    return 0
  fi
  echo "Backing up $kind database '$db' -> $out"
  "${COMPOSE[@]}" exec -T postgres sh -ec 'pg_dump --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$db" | gzip -9 > "$tmp"
  gzip -t "$tmp"
  mv "$tmp" "$out"
}

backup_db "$APP_DB" app
backup_db "$ODOO_DB" odoo

echo "Building immutable release containers..."
"${COMPOSE[@]}" build fastapi frontend celery-worker celery-beat

echo "Applying application database migrations before traffic cutover..."
"${COMPOSE[@]}" run --rm --no-deps -w /app fastapi sh -lc 'PYTHONPATH=/app alembic upgrade head'

echo "Upgrading the bundled Odoo connector..."
"${COMPOSE[@]}" run --rm --no-deps odoo -d "$ODOO_DB" -u elitedom_connector --stop-after-init --no-http

echo "Starting release and waiting for service health..."
"${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 300

"${COMPOSE[@]}" exec -T -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.check_odoo'

actual_ref="$(git rev-parse HEAD)"
[[ "$actual_ref" == "$RELEASE_REF" ]] || fail "working tree moved during deployment"

echo "Deployment completed successfully."
echo "Release: $actual_ref"
echo "Backup directory: $BACKUP_DIR"
"${COMPOSE[@]}" ps
