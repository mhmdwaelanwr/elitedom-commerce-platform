#!/usr/bin/env bash
# Non-mutating readiness audit for an existing Elitedom staging/production host.
# It never installs packages, edits .env, restarts services, or changes volumes.

set -Eeuo pipefail

REPO_PATH="${1:?Usage: preflight_host.sh <repo-path> <staging|production> [site-origin] [api-origin]}"
EXPECTED_ENVIRONMENT="${2:?Missing expected environment}"
SITE_URL="${3:-}"
API_URL="${4:-}"

MIN_CPU_CORES="${PREFLIGHT_MIN_CPU_CORES:-2}"
MIN_RAM_MB="${PREFLIGHT_MIN_RAM_MB:-4096}"
MIN_FREE_DISK_MB="${PREFLIGHT_MIN_FREE_DISK_MB:-10240}"

failures=0
warnings=0

pass() { printf 'PASS: %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; warnings=$((warnings + 1)); }
fail() { printf 'FAIL: %s\n' "$*" >&2; failures=$((failures + 1)); }

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

env_value() {
  local key="$1" value
  value="$(awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      found = $0
    }
    END { print found }
  ' "$ENV_FILE" | tr -d '\r')"
  value="$(trim "$value")"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

csv_has() {
  local csv="$1" wanted="$2" item
  local -a entries=()
  IFS=',' read -r -a entries <<< "$csv"
  for item in "${entries[@]}"; do
    item="$(trim "$item")"
    [[ "$item" == "$wanted" ]] && return 0
  done
  return 1
}

check_secure_directory() {
  local path="$1" label="$2" mode
  if [[ ! -e "$path" ]]; then
    warn "$label does not exist yet: $path"
    return
  fi
  if [[ -L "$path" || ! -d "$path" ]]; then
    fail "$label must be a real directory, not a symlink: $path"
    return
  fi
  mode="$(stat -c '%a' "$path")"
  if [[ "$mode" == "700" ]]; then
    pass "$label permissions are 700"
  else
    fail "$label permissions must be 700 (found $mode)"
  fi
}

check_public_sensitive_port() {
  local port="$1" published="$2"
  if grep -Eq "(^|, )[[:space:]]*0\\.0\\.0\\.0:${port}->|(^|, )[[:space:]]*\\[::\\]:${port}->" <<< "$published"; then
    fail "sensitive port $port is published on a public interface"
  else
    pass "sensitive port $port is not publicly published"
  fi
}

[[ "$EXPECTED_ENVIRONMENT" == "staging" || "$EXPECTED_ENVIRONMENT" == "production" ]] \
  || { echo "expected environment must be staging or production" >&2; exit 2; }
[[ "$REPO_PATH" = /* ]] || { echo "repo path must be absolute" >&2; exit 2; }
if [[ -n "$SITE_URL" && ! "$SITE_URL" =~ ^https://[^/]+/?$ ]]; then
  echo "site origin must be an HTTPS origin" >&2
  exit 2
fi
if [[ -n "$API_URL" && ! "$API_URL" =~ ^https://[^/]+/?$ ]]; then
  echo "API origin must be an HTTPS origin" >&2
  exit 2
fi

printf 'Elitedom host preflight (read-only)\n'
printf 'Target environment: %s\n' "$EXPECTED_ENVIRONMENT"
printf 'Repository: %s\n' "$REPO_PATH"

if [[ "$(uname -s)" == "Linux" ]]; then
  pass "Linux host detected"
else
  fail "deployment host must run Linux"
fi

architecture="$(uname -m)"
if [[ "$architecture" == "x86_64" ]]; then
  pass "architecture is x86_64"
else
  fail "this deployment contract currently expects x86_64 (found $architecture)"
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) pass "supported OS family detected: ${PRETTY_NAME:-$ID}" ;;
    *) fail "supported host OS must be Ubuntu/Debian (found ${PRETTY_NAME:-unknown})" ;;
  esac
else
  fail "/etc/os-release is unavailable"
fi

cpu_cores="$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc)"
if (( cpu_cores >= MIN_CPU_CORES )); then
  pass "CPU capacity is ${cpu_cores} cores (minimum ${MIN_CPU_CORES})"
else
  fail "CPU capacity is ${cpu_cores} cores; minimum is ${MIN_CPU_CORES}"
fi

ram_mb="$(( $(awk '/MemTotal:/ {print $2}' /proc/meminfo) / 1024 ))"
if (( ram_mb >= MIN_RAM_MB )); then
  pass "RAM capacity is ${ram_mb} MB (minimum ${MIN_RAM_MB} MB)"
else
  fail "RAM capacity is ${ram_mb} MB; minimum is ${MIN_RAM_MB} MB"
fi

if [[ -d "$REPO_PATH" ]]; then
  free_disk_mb="$(df -Pm "$REPO_PATH" | awk 'NR==2 {print $4}')"
  if (( free_disk_mb >= MIN_FREE_DISK_MB )); then
    pass "free disk is ${free_disk_mb} MB (minimum ${MIN_FREE_DISK_MB} MB)"
  else
    fail "free disk is ${free_disk_mb} MB; minimum is ${MIN_FREE_DISK_MB} MB"
  fi
else
  fail "repository directory does not exist: $REPO_PATH"
fi

for command_name in git docker gzip awk grep sed stat; do
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "$command_name is installed"
  else
    fail "$command_name is required"
  fi
done

if docker info >/dev/null 2>&1; then
  pass "deployment user can access the Docker daemon"
else
  fail "deployment user cannot access the Docker daemon"
fi
if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose v2 is available"
else
  fail "Docker Compose v2 is unavailable"
fi
if docker compose wait --help >/dev/null 2>&1; then
  pass "Docker Compose supports wait"
else
  fail "Docker Compose must support wait"
fi

if [[ -d "$REPO_PATH/.git" ]]; then
  pass "deployment path is a Git repository root"
  cd "$REPO_PATH"

  if [[ "$(git rev-parse --is-shallow-repository)" == "false" ]]; then
    pass "Git checkout is full/non-shallow"
  else
    fail "deployment checkout must not be shallow"
  fi

  origin="$(git config --get remote.origin.url || true)"
  if [[ "$origin" == *"mhmdwaelanwr/elitedom-erp-architecture"* ]]; then
    pass "Git origin matches the canonical repository"
  else
    fail "Git origin is unexpected"
  fi

  if [[ -z "$(git status --porcelain --untracked-files=no)" ]]; then
    pass "tracked working tree is clean"
  else
    fail "tracked working tree contains local changes"
  fi

  head_ref="$(git rev-parse HEAD 2>/dev/null || true)"
  if [[ "$head_ref" =~ ^[0-9a-fA-F]{40}$ ]]; then
    pass "current checkout has a full Git SHA"
  else
    fail "current checkout SHA is invalid"
  fi
else
  fail "deployment path is not the Git root: $REPO_PATH"
  head_ref="0000000000000000000000000000000000000000"
fi

ENV_FILE="$REPO_PATH/elitedom-store/.env"
if [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]]; then
  pass ".env exists as a regular non-symlink file"
  permissions="$(stat -c '%a' "$ENV_FILE")"
  case "$permissions" in
    600|640) pass ".env permissions are $permissions" ;;
    *) fail ".env permissions must be 600 or 640 (found $permissions)" ;;
  esac

  actual_environment="$(env_value ENVIRONMENT)"
  if [[ "$actual_environment" == "$EXPECTED_ENVIRONMENT" ]]; then
    pass ".env environment identity matches $EXPECTED_ENVIRONMENT"
  else
    fail ".env ENVIRONMENT must be $EXPECTED_ENVIRONMENT before deployment (found ${actual_environment:-unset})"
  fi

  [[ "$(env_value DEBUG)" == "false" ]] \
    && pass "DEBUG is disabled" \
    || fail "DEBUG must be false"
  [[ "$(env_value STAFF_MFA_REQUIRED)" == "true" ]] \
    && pass "staff MFA is required" \
    || fail "STAFF_MFA_REQUIRED must be true"
  [[ "$(env_value RATE_LIMIT_BACKEND)" == "redis" ]] \
    && pass "rate limiting uses Redis" \
    || fail "RATE_LIMIT_BACKEND must be redis"

  trusted_proxies="$(env_value TRUSTED_PROXY_IPS)"
  [[ -n "$trusted_proxies" ]] \
    && pass "trusted proxy configuration is present" \
    || fail "TRUSTED_PROXY_IPS must not be empty"

  allowed_hosts="$(env_value ALLOWED_HOSTS)"
  csv_has "$allowed_hosts" "127.0.0.1" \
    && pass "ALLOWED_HOSTS includes 127.0.0.1 for container health checks" \
    || fail "ALLOWED_HOSTS must include 127.0.0.1"
  csv_has "$allowed_hosts" "localhost" \
    && pass "ALLOWED_HOSTS includes localhost" \
    || fail "ALLOWED_HOSTS must include localhost"

  secret_key="$(env_value SECRET_KEY)"
  jwt_secret_key="$(env_value JWT_SECRET_KEY)"
  postgres_password="$(env_value POSTGRES_PASSWORD)"
  redis_password="$(env_value REDIS_PASSWORD)"
  for secret_name in SECRET_KEY JWT_SECRET_KEY POSTGRES_PASSWORD REDIS_PASSWORD; do
    secret_value="$(env_value "$secret_name")"
    if (( ${#secret_value} >= 32 )); then
      pass "$secret_name is populated with at least 32 characters"
    else
      fail "$secret_name is missing or shorter than 32 characters"
    fi
  done
  if [[ -n "$secret_key" && "$secret_key" != "$jwt_secret_key" ]]; then
    pass "SECRET_KEY and JWT_SECRET_KEY are distinct"
  else
    fail "SECRET_KEY and JWT_SECRET_KEY must be distinct"
  fi

  if [[ -n "$SITE_URL" ]]; then
    site_origin="${SITE_URL%/}"
    cors_origins="$(env_value CORS_ORIGINS)"
    csv_has "$cors_origins" "$site_origin" \
      && pass "CORS_ORIGINS includes the staging storefront origin" \
      || fail "CORS_ORIGINS must include $site_origin"
  fi
  if [[ -n "$API_URL" ]]; then
    api_host="${API_URL#https://}"
    api_host="${api_host%%/*}"
    api_host="${api_host%%:*}"
    csv_has "$allowed_hosts" "$api_host" \
      && pass "ALLOWED_HOSTS includes the API hostname" \
      || fail "ALLOWED_HOSTS must include $api_host"
  fi

  STORE="$REPO_PATH/elitedom-store"
  INFRA="$STORE/infrastructure"
  preflight_site="${SITE_URL:-https://preflight.invalid}"
  preflight_api="${API_URL:-https://api.preflight.invalid}"
  if ENVIRONMENT="$EXPECTED_ENVIRONMENT" \
      RELEASE_REF="$head_ref" \
      VITE_SITE_URL="${preflight_site%/}" \
      VITE_API_URL="${preflight_api%/}/api/v1" \
      docker compose --env-file "$ENV_FILE" \
        -f "$INFRA/docker-compose.yml" \
        -f "$INFRA/docker-compose.prod.yml" \
        config --quiet; then
    pass "hardened Compose topology validates without mutation"
  else
    fail "hardened Compose topology validation failed"
  fi
else
  fail ".env is missing, not a regular file, or is a symlink: $ENV_FILE"
fi

STATE_DIR="$(dirname "$REPO_PATH")/.elitedom-deployment-state"
BACKUP_DIR="${DEPLOY_BACKUP_DIR:-$(dirname "$REPO_PATH")/elitedom-backups}"
check_secure_directory "$STATE_DIR" "deployment state directory"
check_secure_directory "$BACKUP_DIR" "deployment backup directory"

published_ports="$(docker ps --format '{{.Ports}}' 2>/dev/null || true)"
for sensitive_port in 5432 6379 8000 8069 3000 81 9443; do
  check_public_sensitive_port "$sensitive_port" "$published_ports"
done

if grep -Eq '(^|, )[[:space:]]*0\.0\.0\.0:80->|(^|, )[[:space:]]*\[::\]:80->' <<< "$published_ports"; then
  pass "HTTP 80 is publicly published for the reverse proxy"
else
  warn "HTTP 80 is not currently publicly published"
fi
if grep -Eq '(^|, )[[:space:]]*0\.0\.0\.0:443->|(^|, )[[:space:]]*\[::\]:443->' <<< "$published_ports"; then
  pass "HTTPS 443 is publicly published for the reverse proxy"
else
  warn "HTTPS 443 is not currently publicly published"
fi

printf 'Preflight summary: %d failure(s), %d warning(s).\n' "$failures" "$warnings"
(( failures == 0 )) || exit 1
