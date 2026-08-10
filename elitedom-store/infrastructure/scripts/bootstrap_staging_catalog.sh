#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — Staging Catalogue Bootstrap
# Run this ON THE EC2 INSTANCE after deployment to create launch-ready products.
# Requires ALLOW_STAGING_FIXTURES=true in .env
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  Staging Catalogue Bootstrap"
echo "=========================================="

REPO_PATH="${1:-/opt/elitedom}"
ENV_FILE="$REPO_PATH/elitedom-store/.env"

# Verify prerequisites
if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

# Check ALLOW_STAGING_FIXTURES
ALLOW_FIXTURES="$(grep -E '^ALLOW_STAGING_FIXTURES=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' || echo "")"
if [[ "${ALLOW_FIXTURES,,}" != "true" ]]; then
    echo "ERROR: ALLOW_STAGING_FIXTURES must be 'true' in $ENV_FILE"
    echo "Current value: '${ALLOW_FIXTURES:-<not set>}'"
    exit 1
fi

# Run bootstrap via Docker Compose
cd "$REPO_PATH"

COMPOSE=(docker compose --env-file "$ENV_FILE" \
    -f elitedom-store/infrastructure/docker-compose.yml \
    -f elitedom-store/infrastructure/docker-compose.prod.yml)

echo "Running bootstrap script..."
"${COMPOSE[@]}" exec -T fastapi python -m app.scripts.bootstrap_staging_catalog

echo ""
echo "Verifying via API..."
# Wait for API to be ready
for i in {1..30}; do
    if "${COMPOSE[@]}" exec -T fastapi python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/ready')" 2>/dev/null; then
        break
    fi
    sleep 2
done

# Check catalog endpoint
RESULT="$(curl -sf "http://localhost:8000/api/v1/catalog/products?locale=en&page=1&limit=10" 2>/dev/null || echo '{"total_count":0}')"
TOTAL_COUNT="$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("total_count", 0))' 2>/dev/null || echo "0")"

if [[ "$TOTAL_COUNT" -ge 1 ]]; then
    echo "✓ Catalogue bootstrap successful: $TOTAL_COUNT product(s) available"
else
    echo "✗ Catalogue bootstrap failed: no products found"
    exit 1
fi
