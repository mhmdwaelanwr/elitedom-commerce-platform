#!/usr/bin/env bash
# Deploy one immutable Elitedom release on an existing hardened Compose host.
# Normal deployments are forward-only after the first successful deployment.
# This script never overwrites .env or restores/downgrades databases automatically.

set -Eeuo pipefail

RELEASE_REF="${1:?Usage: deploy_release.sh <40-char-sha> <repo-path> <site-origin> <api-origin> <staging|production>}"
REPO_PATH="${2:?Missing repo path}"
SITE_URL="${3:?Missing site origin}"
API_URL="${4:?Missing API origin}"
EXPECTED_ENVIRONMENT="${5:?Missing expected environment}"

fail() { echo "ERROR: $*" >&2; exit 1; }
dotenv_value() {
  local key="$1" value
  value="$(awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      found = $0
    }
    END { print found }
  ' "$ENV_FILE" | tr -d '\r')"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

[[ "$RELEASE_REF" =~ ^[0-9a-fA-F]{40}$ ]] || fail "release ref must be a full 40-character Git SHA"
[[ "$REPO_PATH" = /* ]] || fail "deployment path must be absolute"
[[ "$SITE_URL" =~ ^https://[^/]+/?$ ]] || fail "site URL must be a credential-free HTTPS origin"
[[ "$API_URL" =~ ^https://[^/]+/?$ ]] || fail "API URL must be a credential-free HTTPS origin"
[[ "$EXPECTED_ENVIRONMENT" == "staging" || "$EXPECTED_ENVIRONMENT" == "production" ]] \
  || fail "expected environment must be staging or production"

command -v git >/dev/null || fail "git is required"
command -v docker >/dev/null || fail "docker is required"
command -v awk >/dev/null || fail "awk is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"
docker compose wait --help >/dev/null 2>&1 || fail "Docker Compose must support the wait command"
command -v gzip >/dev/null || fail "gzip is required"

cd "$REPO_PATH"
[[ -d .git ]] || fail "deployment path is not a Git repository"
[[ "$(git rev-parse --is-shallow-repository)" == "false" ]] || fail "deployment repository must not be shallow"
origin="$(git config --get remote.origin.url || true)"
[[ "$origin" == *"mhmdwaelanwr/elitedom-erp-architecture"* ]] || fail "unexpected Git origin"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked deployment checkout has local changes"

checkout_ref="$(git rev-parse HEAD)"
STATE_DIR="$(dirname "$REPO_PATH")/.elitedom-deployment-state"
STATE_FILE="$STATE_DIR/release_ref"
[[ ! -L "$STATE_DIR" ]] || fail "deployment state directory must not be a symlink"
[[ ! -L "$STATE_FILE" ]] || fail "deployment state file must not be a symlink"

previous_release_ref=""
if [[ -e "$STATE_FILE" ]]; then
  [[ -f "$STATE_FILE" ]] || fail "deployment state release_ref is not a regular file"
  previous_release_ref="$(tr -d '\r\n' < "$STATE_FILE")"
  [[ "$previous_release_ref" =~ ^[0-9a-fA-F]{40}$ ]] || fail "deployment state contains an invalid release ref"
fi

echo "Target environment: $EXPECTED_ENVIRONMENT"
echo "Checkout before deploy: $checkout_ref"
if [[ -n "$previous_release_ref" ]]; then
  echo "Last successful deployed release: $previous_release_ref"
else
  echo "Last successful deployed release: unrecorded bootstrap"
fi
echo "Requested release: $RELEASE_REF"

git fetch --prune origin main
git cat-file -e "${RELEASE_REF}^{commit}" || fail "release commit does not exist"
git merge-base --is-ancestor "$RELEASE_REF" origin/main || fail "release is not reachable from origin/main"

if [[ -n "$previous_release_ref" ]]; then
  git cat-file -e "${previous_release_ref}^{commit}" || fail "recorded deployed release is missing from the Git object database"
  git merge-base --is-ancestor "$previous_release_ref" "$RELEASE_REF" \
    || fail "normal deployment is forward-only; use the controlled rollback procedure for an older release"
fi

git checkout --detach "$RELEASE_REF"

ENV_FILE="$REPO_PATH/elitedom-store/.env"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail "deployment .env is missing or is a symlink"
permissions="$(stat -c '%a' "$ENV_FILE")"
case "$permissions" in 600|640) ;; *) fail "deployment .env permissions must be 600 or 640 (found $permissions)" ;; esac

configured_environment="$(dotenv_value ENVIRONMENT)"
[[ "$configured_environment" == "$EXPECTED_ENVIRONMENT" ]] \
  || fail "host .env ENVIRONMENT must match the protected target '$EXPECTED_ENVIRONMENT' (found '${configured_environment:-unset}')"

export ENVIRONMENT="$configured_environment"
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

install -d -m 700 "$STATE_DIR"
state_tmp="$(mktemp "$STATE_DIR/.release_ref.XXXXXX")"
printf '%s\n' "$actual_ref" > "$state_tmp"
chmod 600 "$state_tmp"
mv -f "$state_tmp" "$STATE_FILE"

echo "Deployment completed successfully."
echo "Environment: $configured_environment"
echo "Release: $actual_ref"
echo "Recorded deployment state: $STATE_FILE"
echo "Backup directory: $BACKUP_DIR"
"${COMPOSE[@]}" ps
