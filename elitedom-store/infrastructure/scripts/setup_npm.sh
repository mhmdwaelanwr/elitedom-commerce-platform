#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — NPM Proxy Host Setup
# Run this ON THE EC2 INSTANCE after DNS is configured.
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  Elitedom NPM Proxy Host Setup"
echo "=========================================="

SITE_DOMAIN="${1:-staging.elitedom.store}"
API_DOMAIN="${2:-api.staging.elitedom.store}"

echo "Site Domain: $SITE_DOMAIN"
echo "API Domain: $API_DOMAIN"
echo ""

# Check if NPM is running
if ! docker ps --format '{{.Names}}' | grep -q "elitedom-nginx"; then
    echo "ERROR: Nginx Proxy Manager container not found."
    echo "Run: cd /opt/elitedom/elitedom-store && make dev"
    exit 1
fi

echo "NPM container is running."
echo ""

echo "=========================================="
echo "  NPM Proxy Host Configuration Guide"
echo "=========================================="
echo ""
echo "Open NPM Admin UI: http://127.0.0.1:81"
echo ""
echo "=== Proxy Host 1: Frontend ($SITE_DOMAIN) ==="
echo "Domain Names: $SITE_DOMAIN"
echo "Scheme: http"
echo "Forward Hostname: frontend"
echo "Forward Port: 3000"
echo ""
echo "SSL Tab:"
echo "  - Request a new SSL Certificate"
echo "  - Force SSL: ON"
echo "  - HTTP/2 Support: ON"
echo "  - HSTS Enabled: ON"
echo ""
echo "Advanced Tab:"
echo "  location /api/ {"
echo "    proxy_pass http://fastapi:8000;"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "  }"
echo ""
echo "=== Proxy Host 2: API ($API_DOMAIN) ==="
echo "Domain Names: $API_DOMAIN"
echo "Scheme: http"
echo "Forward Hostname: fastapi"
echo "Forward Port: 8000"
echo ""
echo "SSL Tab:"
echo "  - Request a new SSL Certificate"
echo "  - Force SSL: ON"
echo "  - HTTP/2 Support: ON"
echo "  - HSTS Enabled: ON"
echo ""
echo "=== DNS Records Needed ==="
echo "Type  Name                    Value"
echo "A     staging.elitedom.store  <ELASTIC_IP>"
echo "A     api.staging.elitedom.store  <ELASTIC_IP>"
echo ""
echo "After DNS propagates and certificates are issued:"
echo "  Site: https://$SITE_DOMAIN"
echo "  API:  https://$API_DOMAIN/api/v1"
