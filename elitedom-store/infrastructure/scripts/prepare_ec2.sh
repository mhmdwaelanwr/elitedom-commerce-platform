#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — AWS EC2 Instance Preparation
# Run this ON THE EC2 INSTANCE to prepare it for deployment.
# Does NOT require AWS credentials on the instance.
# Does NOT associate Elastic IP (run from your local machine or AWS Console).
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  Elitedom EC2 Instance Preparation"
echo "=========================================="

INSTANCE_ID="$(curl -s --max-time 10 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "UNKNOWN")"
REGION="$(curl -s --max-time 10 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "eu-central-1")"

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo ""

# ============================================
# Step 1: Verify prerequisites
# ============================================
echo "--- Step 1: Verify Prerequisites ---"

for cmd in git docker gzip stat; do
    if command -v "$cmd" >/dev/null 2>&1; then
        echo "  ✓ $cmd"
    else
        echo "  ✗ $cmd — REQUIRED"
        exit 1
    fi
done

if docker compose version >/dev/null 2>&1; then
    echo "  ✓ Docker Compose v2"
else
    echo "  ✗ Docker Compose v2 — REQUIRED"
    exit 1
fi

echo ""

# ============================================
# Step 2: Clone/update repository
# ============================================
echo "--- Step 2: Repository Setup ---"

REPO_PATH="/opt/elitedom"
if [[ -d "$REPO_PATH/.git" ]]; then
    echo "Repository exists at $REPO_PATH"
    cd "$REPO_PATH"
    git fetch --all
    echo "Current HEAD: $(git rev-parse --short HEAD)"
else
    echo "Cloning repository to $REPO_PATH..."
    sudo mkdir -p /opt
    sudo chown "$(id -u):$(id -g)" /opt
    git clone https://github.com/mhmdwaelanwr/elitedom-erp-architecture.git "$REPO_PATH"
    cd "$REPO_PATH"
    echo "Cloned. HEAD: $(git rev-parse --short HEAD)"
fi
echo ""

# ============================================
# Step 3: Required directories
# ============================================
echo "--- Step 3: Required Directories ---"

BACKUP_DIR="/opt/elitedom-backups"
STATE_DIR="/opt/.elitedom-deployment-state"

sudo mkdir -p "$BACKUP_DIR" "$STATE_DIR"
sudo chmod 700 "$BACKUP_DIR"
sudo chmod 700 "$STATE_DIR"
sudo chown "$(id -u):$(id -g)" "$BACKUP_DIR" "$STATE_DIR"
echo "  ✓ $BACKUP_DIR (permissions 700)"
echo "  ✓ $STATE_DIR (permissions 700)"
echo ""

# ============================================
# Step 4: Environment file
# ============================================
echo "--- Step 4: Environment File ---"

ENV_FILE="$REPO_PATH/elitedom-store/.env"
if [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]]; then
    echo "  ✓ .env exists at $ENV_FILE"
    PERMS="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo unknown)"
    echo "  Permissions: $PERMS"
    if [[ "$PERMS" != "600" && "$PERMS" != "640" ]]; then
        echo "  Fixing permissions to 600..."
        chmod 600 "$ENV_FILE"
    fi
else
    echo "  ✗ .env file missing — you must create it with production values"
    echo "    NEVER use .env.example as .env in production"
fi
echo ""

# ============================================
# Step 5: Create deployment user (optional)
# ============================================
echo "--- Step 5: Deployment User ---"

DEPLOY_USER="ubuntu"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "  ✓ User '$DEPLOY_USER' exists"
else
    echo "  Creating deployment user '$DEPLOY_USER'..."
    sudo useradd -m -s /bin/bash "$DEPLOY_USER"
    sudo usermod -aG docker "$DEPLOY_USER"
    echo "  ✓ User '$DEPLOY_USER' created and added to docker group"
fi

# Ensure SSH directory exists
DEPLOY_HOME="$(eval echo ~$DEPLOY_USER)"
sudo mkdir -p "$DEPLOY_HOME/.ssh"
sudo chmod 700 "$DEPLOY_HOME/.ssh"
sudo touch "$DEPLOY_HOME/.ssh/authorized_keys"
sudo chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
echo "  ✓ SSH directory prepared for $DEPLOY_USER"
echo ""

# ============================================
# Step 6: Generate SSH host keys for known_hosts
# ============================================
echo "--- Step 6: SSH Host Keys ---"

echo "SSH host keys (for DEPLOY_KNOWN_HOSTS):"
ssh-keyscan -t ed25519,ecdsa,rsa localhost 2>/dev/null || echo "  (ssh-keyscan failed — get keys after Elastic IP is assigned)"
echo ""
echo ">>> After Elastic IP is assigned, run from your LOCAL machine:"
echo "    ssh-keyscan -t ed25519,ecdsa,rsa <ELASTIC_IP>"
echo "    Use that output as DEPLOY_KNOWN_HOSTS in GitHub Environment"
echo ""

# ============================================
# Step 7: Verify Docker
# ============================================
echo "--- Step 7: Docker Verification ---"

if docker ps >/dev/null 2>&1; then
    echo "  ✓ Docker daemon is running"
    echo "  Containers:"
    docker ps --format '  {{.Names}}\t{{.Status}}' 2>/dev/null || true
else
    echo "  ✗ Docker daemon is not running"
fi
echo ""

# ============================================
# Step 8: System resources
# ============================================
echo "--- Step 8: System Resources ---"

AVAIL_KB="$(df --output=avail / 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"
AVAIL_GB=$(( AVAIL_KB / 1048576 ))
echo "  Disk: ${AVAIL_GB}GB available"

TOTAL_MEM_KB="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)"
TOTAL_MEM_MB=$(( TOTAL_MEM_KB / 1024 ))
echo "  Memory: ${TOTAL_MEM_MB}MB"

SWAP_KB="$(grep SwapTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)"
SWAP_MB=$(( SWAP_KB / 1024 ))
echo "  Swap: ${SWAP_MB}MB"
echo ""

# ============================================
# Summary
# ============================================
echo "=========================================="
echo "  INSTANCE PREPARATION COMPLETE"
echo "=========================================="
echo ""
echo "Next steps (run from YOUR LOCAL MACHINE, not here):"
echo ""
echo "1. Allocate & associate Elastic IP:"
echo "   aws ec2 allocate-address --domain vpc --region $REGION"
echo "   aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id <ID> --region $REGION"
echo ""
echo "2. Get SSH known_hosts (after Elastic IP is live):"
echo "   ssh-keyscan -t ed25519,ecdsa,rsa <ELASTIC_IP>"
echo ""
echo "3. Create IAM Role for GitHub OIDC (from your local machine or CloudShell):"
echo "   bash infrastructure/scripts/setup_oidc_role.sh"
echo ""
echo "4. Configure GitHub Environment 'staging' with all values"
echo ""
echo "5. Deploy via GitHub Actions"
