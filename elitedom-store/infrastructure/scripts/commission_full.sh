#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — Full Commissioning Runbook
# Execute each section in order. Some steps require manual intervention.
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  ELITEDOM STAGING COMMISSIONING"
echo "=========================================="
echo ""
echo "This script guides you through the full staging setup."
echo "Some steps are automated, others require manual action."
echo ""

# ============================================
# Phase 1: AWS Infrastructure
# ============================================
echo "=== PHASE 1: AWS Infrastructure ==="
echo ""
echo "Run this script ON THE EC2 INSTANCE:"
echo "  bash infrastructure/scripts/commission_aws.sh"
echo ""
echo "This will:"
echo "  1. Allocate Elastic IP"
echo "  2. Associate with EC2 instance"
echo "  3. Create IAM Role for GitHub OIDC"
echo "  4. Output all required GitHub Environment values"
echo ""

read -p "Press Enter after completing AWS setup..."

# ============================================
# Phase 2: GitHub Environment
# ============================================
echo "=== PHASE 2: GitHub Environment ==="
echo ""
echo "Configure the 'staging' environment in GitHub:"
echo "  https://github.com/mhmdwaelanwr/elitedom-erp-architecture/settings/environments"
echo ""
echo "Required Secrets:"
echo "  DEPLOY_HOST          = <ELASTIC_IP>"
echo "  DEPLOY_USER          = ubuntu"
echo "  DEPLOY_KNOWN_HOSTS   = <SSH_KEYSCAN_OUTPUT>"
echo ""
echo "Required Variables:"
echo "  DEPLOY_PATH          = /opt/elitedom"
echo "  SITE_URL             = https://staging.elitedom.store"
echo "  API_URL              = https://api.staging.elitedom.store"
echo "  AWS_REGION           = eu-central-1"
echo "  AWS_ROLE_TO_ASSUME   = <IAM_ROLE_ARN>"
echo "  EC2_SECURITY_GROUP_ID = <SG_ID>"
echo ""

read -p "Press Enter after configuring GitHub Environment..."

# ============================================
# Phase 3: DNS
# ============================================
echo "=== PHASE 3: DNS Configuration ==="
echo ""
echo "Add DNS records at your domain registrar:"
echo ""
echo "  Type  Name                          Value"
echo "  A     staging.elitedom.store        <ELASTIC_IP>"
echo "  A     api.staging.elitedom.store    <ELASTIC_IP>"
echo ""
echo "Wait for DNS propagation (5-30 minutes)."
echo "Verify with: dig staging.elitedom.store"
echo ""

read -p "Press Enter after DNS propagates..."

# ============================================
# Phase 4: TLS Certificates
# ============================================
echo "=== PHASE 4: TLS Certificates ==="
echo ""
echo "Open NPM Admin UI: http://<EC2_IP>:81"
echo ""
echo "Create proxy hosts:"
echo "  1. staging.elitedom.store -> frontend:3000"
echo "  2. api.staging.elitedom.store -> fastapi:8000"
echo ""
echo "Request Let's Encrypt certificates for both."
echo ""

read -p "Press Enter after TLS is configured..."

# ============================================
# Phase 5: Server Validation
# ============================================
echo "=== PHASE 5: Server Validation ==="
echo ""
echo "SSH into the server and run:"
echo "  cd /opt/elitedom/elitedom-store"
echo "  bash infrastructure/scripts/preflight_host.sh"
echo ""
echo "Ensure all checks pass before proceeding."
echo ""

read -p "Press Enter after preflight passes..."

# ============================================
# Phase 6: Deploy
# ============================================
echo "=== PHASE 6: Deploy ==="
echo ""
echo "Option A: Manual deployment"
echo "  1. Go to: https://github.com/mhmdwaelanwr/elitedom-erp-architecture/actions/workflows/deploy.yml"
echo "  2. Click 'Run workflow'"
echo "  3. Select 'staging' environment"
echo "  4. Enter the 40-character SHA from main"
echo "  5. Click 'Run workflow'"
echo ""
echo "Option B: Automatic deployment"
echo "  1. Merge PR to main"
echo "  2. CI runs automatically"
echo "  3. On CI success, auto-deploy triggers"
echo "  4. Check: https://github.com/mhmdwaelanwr/elitedom-erp-architecture/actions/workflows/auto-deploy-staging.yml"
echo ""

read -p "Press Enter after deployment completes..."

# ============================================
# Phase 7: Verify
# ============================================
echo "=== PHASE 7: Verification ==="
echo ""
echo "1. Health check:"
echo "   curl -s https://api.staging.elitedom.store/health/live | jq ."
echo ""
echo "2. Frontend:"
echo "   curl -I https://staging.elitedom.store"
echo ""
echo "3. Launch smoke:"
echo "   https://github.com/mhmdwaelanwr/elitedom-erp-architecture/actions/workflows/launch-smoke.yml"
echo ""

echo "=========================================="
echo "  COMMISSIONING COMPLETE"
echo "=========================================="
echo ""
echo "Next: Configure provider credentials one-by-one."
echo "Start with Paymob sandbox for payment testing."
