#!/usr/bin/env bash
# Elitedom Store — Non-destructive host preflight validation.
# Verifies the deployment contract without mutating the server.
# Usage: preflight_host.sh [repo-path]

set -Eeuo pipefail

REPO_PATH="${1:-/opt/elitedom}"
STORE_PATH="$REPO_PATH/elitedom-store"
INFRA_PATH="$STORE_PATH/infrastructure"
ENV_FILE="$STORE_PATH/.env"
STATE_DIR="$(dirname "$REPO_PATH")/.elitedom-deployment-state"
STATE_FILE="$STATE_DIR/release_ref"
FAILURES=0
WARNINGS=0

pass()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail()  { printf '  \033[31m✗\033[0m %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
warn()  { printf '  \033[33m!\033[0m %s\n' "$*"; WARNINGS=$((WARNINGS + 1)); }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }

section "Operating System"
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  if [[ "${ID:-}" == "ubuntu" ]]; then
    pass "Ubuntu detected: ${PRETTY_NAME:-unknown}"
  else
    warn "Non-Ubuntu OS detected: ${ID:-unknown} — supported is Ubuntu"
  fi
else
  warn "Cannot detect OS from /etc/os-release"
fi

ARCH="$(uname -m 2>/dev/null || true)"
if [[ "$ARCH" == "x86_64" ]]; then
  pass "Architecture: x86_64"
else
  fail "Architecture must be x86_64 (found: $ARCH)"
fi

section "User and Permissions"
CURRENT_USER="$(id -un 2>/dev/null || true)"
pass "Running as: $CURRENT_USER"
if id -nG "$CURRENT_USER" 2>/dev/null | grep -qw docker; then
  pass "User '$CURRENT_USER' is in the docker group"
else
  warn "User '$CURRENT_USER' is not in the docker group (may need sudo for docker)"
fi

section "Required Software"
for cmd in git docker gzip stat; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "$cmd found: $(command -v "$cmd")"
  else
    fail "$cmd is required but not found"
  fi
done

if docker compose version >/dev/null 2>&1; then
  COMPOSE_VERSION="$(docker compose version --short 2>/dev/null || echo unknown)"
  pass "Docker Compose v2: $COMPOSE_VERSION"
else
  fail "Docker Compose v2 is required but not found"
fi

if docker compose wait --help >/dev/null 2>&1; then
  pass "Docker Compose supports 'wait' command"
else
  warn "Docker Compose does not support 'wait' command (deploy may fail)"
fi

section "Git Repository"
if [[ -d "$REPO_PATH/.git" ]]; then
  pass "Git repository exists at $REPO_PATH"
else
  fail "Git repository not found at $REPO_PATH"
fi

if [[ -d "$STORE_PATH" ]]; then
  pass "Application path exists: $STORE_PATH"
else
  fail "Application path missing: $STORE_PATH"
fi

if [[ -d "$INFRA_PATH" ]]; then
  pass "Infrastructure path exists: $INFRA_PATH"
else
  fail "Infrastructure path missing: $INFRA_PATH"
fi

SHALLOW="$(git -C "$REPO_PATH" rev-parse --is-shallow-repository 2>/dev/null || echo unknown)"
if [[ "$SHALLOW" == "false" ]]; then
  pass "Repository is not shallow"
else
  fail "Repository must not be shallow (found: $SHALLOW)"
fi

ORIGIN="$(git -C "$REPO_PATH" config --get remote.origin.url 2>/dev/null || echo none)"
if [[ "$ORIGIN" == *"mhmdwaelanwr/elitedom-erp-architecture"* ]]; then
  pass "Git origin matches expected repository"
else
  warn "Git origin does not match expected repository: $ORIGIN"
fi

CLEAN="$(git -C "$REPO_PATH" status --porcelain --untracked-files=no 2>/dev/null | wc -l)"
if [[ "$CLEAN" -eq 0 ]]; then
  pass "Working tree is clean"
else
  warn "Working tree has $CLEAN uncommitted changes"
fi

section "Environment File"
if [[ -f "$ENV_FILE" ]]; then
  pass ".env file exists"
else
  fail ".env file missing at $ENV_FILE"
fi

if [[ ! -L "$ENV_FILE" ]]; then
  pass ".env is a regular file (not a symlink)"
else
  fail ".env must not be a symlink"
fi

if [[ -f "$ENV_FILE" ]]; then
  PERMS="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo unknown)"
  case "$PERMS" in
    600|640) pass ".env permissions: $PERMS" ;;
    *)       fail ".env permissions must be 600 or 640 (found: $PERMS)" ;;
  esac
fi

section "Environment Identity (names only, no values)"
if [[ -f "$ENV_FILE" ]]; then
  # Check required variable NAMES exist without exposing values
  for var_name in ENVIRONMENT SECRET_KEY JWT_SECRET_KEY POSTGRES_PASSWORD REDIS_PASSWORD; do
    if grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
      pass "Required variable name present: $var_name"
    else
      fail "Required variable name missing: $var_name"
    fi
  done

  # Check environment identity without printing secrets
  ENV_VAL="$(grep '^ENVIRONMENT=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || echo unset)"
  if [[ "$ENV_VAL" == "staging" || "$ENV_VAL" == "production" ]]; then
    pass "ENVIRONMENT identity: $ENV_VAL"
  else
    warn "ENVIRONMENT is '$ENV_VAL' — expected staging or production"
  fi
fi

section "Deployment State"
if [[ -d "$STATE_DIR" && ! -L "$STATE_DIR" ]]; then
  pass "Deployment state directory exists: $STATE_DIR"
else
  warn "Deployment state directory missing: $STATE_DIR (first deploy)"
fi

if [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" ]]; then
  RELEASE="$(tr -d '\r\n' < "$STATE_FILE")"
  if [[ "$RELEASE" =~ ^[0-9a-fA-F]{40}$ ]]; then
    pass "Last deployed release: ${RELEASE:0:12}..."
  else
    fail "Deployment state contains invalid release ref"
  fi
else
  warn "No deployment state file (first deploy)"
fi

section "Docker Compose Validation"
if [[ -f "$ENV_FILE" && -f "$INFRA_PATH/docker-compose.yml" && -f "$INFRA_PATH/docker-compose.prod.yml" ]]; then
  if docker compose --env-file "$ENV_FILE" \
    -f "$INFRA_PATH/docker-compose.yml" \
    -f "$INFRA_PATH/docker-compose.prod.yml" \
    config --quiet 2>/dev/null; then
    pass "Production Docker Compose config validates"
  else
    fail "Production Docker Compose config validation failed"
  fi
else
  warn "Skipping Compose validation (missing files)"
fi

section "Disk and Memory"
AVAIL_KB="$(df --output=avail / 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"
AVAIL_GB=$(( AVAIL_KB / 1048576 ))
if [[ $AVAIL_GB -ge 10 ]]; then
  pass "Available disk: ${AVAIL_GB}GB"
else
  warn "Low disk space: ${AVAIL_GB}GB (recommended >= 10GB)"
fi

TOTAL_MEM_KB="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)"
TOTAL_MEM_MB=$(( TOTAL_MEM_KB / 1024 ))
if [[ $TOTAL_MEM_MB -ge 4096 ]]; then
  pass "Total memory: ${TOTAL_MEM_MB}MB"
else
  warn "Low memory: ${TOTAL_MEM_MB}MB (recommended >= 4096MB)"
fi

section "Network Expectations"
pass "Expected public ports: 80 (HTTP), 443 (HTTPS)"
pass "Expected internal ports: 3000 (frontend), 8000 (API), 8069 (Odoo)"
pass "NPM admin port 81 should be loopback-only"
pass "Portainer port 9443 should be loopback-only"
pass "PostgreSQL, Redis, FastAPI, Odoo should NOT be directly public"

section "Summary"
TOTAL=$((FAILURES + WARNINGS))
if [[ $FAILURES -eq 0 ]]; then
  printf '\n\033[32mPreflight passed\033[0m (%d warnings)\n\n' "$WARNINGS"
  exit 0
else
  printf '\n\033[31mPreflight failed\033[0m (%d failures, %d warnings)\n\n' "$FAILURES" "$WARNINGS"
  exit 1
fi
