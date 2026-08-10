#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — AWS EC2 Commissioning Script
# Run this ON THE EC2 INSTANCE to set up infrastructure.
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  Elitedom AWS EC2 Commissioning"
echo "=========================================="

INSTANCE_ID="$(curl -s --max-time 10 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "UNKNOWN")"
REGION="$(curl -s --max-time 10 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "eu-central-1")"
CURRENT_IP="$(curl -s --max-time 10 https://checkip.amazonaws.com 2>/dev/null || echo "UNKNOWN")"

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo "Current IP: $CURRENT_IP"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "ERROR: AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

echo "AWS Identity:"
aws sts get-caller-identity --query 'Arn' --output text
echo ""

# ============================================
# Step 1: Allocate Elastic IP
# ============================================
echo "--- Step 1: Allocate Elastic IP ---"

EXISTING_EIP="$(aws ec2 describe-addresses --region "$REGION" \
    --query "Addresses[?contains(Site,'elitedom') || contains(Tags[?Key=='Name'].Value,'elitedom')].PublicIp" \
    --output text 2>/dev/null || echo "")"

if [[ -z "$EXISTING_EIP" || "$EXISTING_EIP" == "None" ]]; then
    ALLOCATION_ID="$(aws ec2 allocate-address --region "$REGION" \
        --domain vpc \
        --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=elitedom-staging},{Key=Environment,Value=staging},{Key=Project,Value=elitedom}]' \
        --query 'AllocationId' --output text)"
    
    EIP="$(aws ec2 describe-addresses --region "$REGION" \
        --allocation-ids "$ALLOCATION_ID" \
        --query 'Addresses[0].PublicIp' --output text)"
    
    echo "Allocated Elastic IP: $EIP"
    echo "Allocation ID: $ALLOCATION_ID"
    
    # Associate with instance
    aws ec2 associate-address --region "$REGION" \
        --instance-id "$INSTANCE_ID" \
        --allocation-id "$ALLOCATION_ID" \
        --allow-reassociation
    
    echo "Associated Elastic IP $EIP with instance $INSTANCE_ID"
else
    EIP="$EXISTING_EIP"
    echo "Existing Elastic IP found: $EIP"
fi

echo ""
echo ">>> ACTION: Update DEPLOY_HOST in GitHub Environment to: $EIP"
echo ""

# ============================================
# Step 2: Get Security Group ID
# ============================================
echo "--- Step 2: Security Group ---"

SG_ID="$(aws ec2 describe-instances --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)"

echo "Security Group ID: $SG_ID"
echo ""
echo ">>> ACTION: Set EC2_SECURITY_GROUP_ID in GitHub Environment to: $SG_ID"
echo ""

# ============================================
# Step 3: Get SSH host key
# ============================================
echo "--- Step 3: SSH Host Key ---"

SSH_HOST_KEY="$(ssh-keyscan -t ed25519,ecdsa,rsa localhost 2>/dev/null | tr '\n' '|')"
echo "SSH Known Hosts entry:"
echo "$SSH_HOST_KEY"
echo ""
echo ">>> ACTION: Set DEPLOY_KNOWN_HOSTS in GitHub Environment"
echo ""

# ============================================
# Step 4: Create IAM Role for OIDC
# ============================================
echo "--- Step 4: OIDC IAM Role ---"

ROLE_NAME="elitedom-github-actions-staging"
ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
GITHUB_REPO="mhmdwaelanwr/elitedom-erp-architecture"

# Check if role exists
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "IAM Role '$ROLE_NAME' already exists"
    ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
else
    # Create OIDC provider if not exists
    OIDC_URL="https://token.actions.githubusercontent.com"
    if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" >/dev/null 2>&1; then
        aws iam create-open-id-connect-provider \
            --url "$OIDC_URL" \
            --client-id-list "sts.amazonaws.com" \
            --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" 2>/dev/null || true
        echo "Created OIDC provider"
    fi

    # Create trust policy
    cat > /tmp/oidc-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:environment:staging"
        }
      }
    }
  ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/oidc-trust-policy.json \
        --description "GitHub Actions OIDC role for Elitedom staging deployment"

    # Create inline policy for EC2 Security Group access
    cat > /tmp/deploy-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSecurityGroupRules"
      ],
      "Resource": "arn:aws:ec2:${REGION}:${ACCOUNT_ID}:security-group/${SG_ID}"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name elitedom-staging-ssh-access \
        --policy-document file:///tmp/deploy-policy.json

    ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
    echo "Created IAM Role: $ROLE_ARN"
    echo "Waiting 30 seconds for role propagation..."
    sleep 30
fi

echo ""
echo ">>> ACTION: Set AWS_ROLE_TO_ASSUME in GitHub Environment to: $ROLE_ARN"
echo ""

# ============================================
# Step 5: Verify repo exists
# ============================================
echo "--- Step 5: Verify Repository ---"

if [[ -d /opt/elitedom/.git ]]; then
    echo "Repository found at /opt/elitedom"
    cd /opt/elitedom
    echo "Current HEAD: $(git rev-parse HEAD)"
    echo "Origin: $(git config --get remote.origin.url)"
else
    echo "WARNING: Repository not found at /opt/elitedom"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "=========================================="
echo "  COMMISSIONING SUMMARY"
echo "=========================================="
echo ""
echo "GitHub Environment 'staging' needs these values:"
echo ""
echo "Secrets:"
echo "  DEPLOY_HOST=$EIP"
echo "  DEPLOY_USER=ubuntu"
echo "  DEPLOY_KNOWN_HOSTS=<from ssh-keyscan above>"
echo ""
echo "Variables:"
echo "  DEPLOY_PATH=/opt/elitedom"
echo "  SITE_URL=https://staging.elitedom.store"
echo "  API_URL=https://api.staging.elitedom.store"
echo "  AWS_REGION=$REGION"
echo "  AWS_ROLE_TO_ASSUME=$ROLE_ARN"
echo "  EC2_SECURITY_GROUP_ID=$SG_ID"
echo ""
echo "Next steps:"
echo "1. Update DEPLOY_HOST to $EIP in GitHub Environment"
echo "2. Configure DNS: staging.elitedom.store -> $EIP"
echo "3. Configure DNS: api.staging.elitedom.store -> $EIP"
echo "4. Install NPM proxy hosts"
echo "5. Run preflight_host.sh"
echo "6. Deploy!"
