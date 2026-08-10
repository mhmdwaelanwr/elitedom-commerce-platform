#!/usr/bin/env bash
# =============================================================================
# Elitedom Store — AWS IAM Role Setup for GitHub OIDC
# Run this from YOUR LOCAL MACHINE or AWS CloudShell (NOT from the EC2 instance).
# Requires: AWS CLI configured with appropriate permissions.
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  AWS OIDC IAM Role Setup"
echo "=========================================="

# Configuration
GITHUB_REPO="mhmdwaelanwr/elitedom-erp-architecture"
ROLE_NAME="elitedom-github-actions-staging"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"

# Get account ID
ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || echo "")"
if [[ -z "$ACCOUNT_ID" ]]; then
    echo "ERROR: AWS CLI not configured or credentials invalid."
    echo "Run 'aws configure' or set AWS environment variables."
    exit 1
fi
echo "AWS Account: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# ============================================
# Step 1: Create OIDC Identity Provider
# ============================================
echo "--- Step 1: OIDC Identity Provider ---"

OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
    echo "  ✓ OIDC provider already exists"
else
    echo "  Creating OIDC provider..."
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --client-id-list "sts.amazonaws.com" \
        --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
        --tags "Key=Project,Value=elitedom" "Key=Environment,Value=staging"
    echo "  ✓ OIDC provider created"
fi
echo ""

# ============================================
# Step 2: Create IAM Role
# ============================================
echo "--- Step 2: IAM Role ---"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "  ✓ Role '$ROLE_NAME' already exists"
    ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
else
    echo "  Creating role..."
    
    cat > /tmp/oidc-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_ARN}"
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

    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/oidc-trust-policy.json \
        --description "GitHub Actions OIDC role for Elitedom staging deployment" \
        --tags "Key=Project,Value=elitedom" "Key=Environment,Value=staging"
    
    ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
    echo "  ✓ Role created: $ROLE_ARN"
    echo "  Waiting 10 seconds for propagation..."
    sleep 10
fi
echo ""

# ============================================
# Step 3: Create deployment policy
# ============================================
echo "--- Step 3: Deployment Policy ---"

cat > /tmp/deploy-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2InstanceConnect",
      "Effect": "Allow",
      "Action": [
        "ec2-instance-connect:SendSSHPublicKey"
      ],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "eu-central-1"
        }
      }
    },
    {
      "Sid": "EC2SecurityGroup",
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSecurityGroupRules"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "eu-central-1"
        }
      }
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name elitedom-staging-deployment \
    --policy-document file:///tmp/deploy-policy.json

echo "  ✓ Deployment policy attached"
echo ""

# ============================================
# Step 4: Allocate Elastic IP
# ============================================
echo "--- Step 4: Elastic IP ---"

EXISTING_EIP="$(aws ec2 describe-addresses --region "$REGION" \
    --filters "Name=tag:Project,Values=elitedom" "Name=tag:Environment,Values=staging" \
    --query 'Addresses[0].PublicIp' --output text 2>/dev/null || echo "None")"

if [[ -n "$EXISTING_EIP" && "$EXISTING_EIP" != "None" ]]; then
    echo "  ✓ Existing Elastic IP: $EXISTING_EIP"
    EIP="$EXISTING_EIP"
else
    ALLOCATION_ID="$(aws ec2 allocate-address --region "$REGION" \
        --domain vpc \
        --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=elitedom-staging},{Key=Project,Value=elitedom},{Key=Environment,Value=staging}]' \
        --query 'AllocationId' --output text)"
    
    EIP="$(aws ec2 describe-addresses --region "$REGION" \
        --allocation-ids "$ALLOCATION_ID" \
        --query 'Addresses[0].PublicIp' --output text 2>/dev/null || echo "")"
    
    if [[ -z "$EIP" || "$EIP" == "None" ]]; then
        echo "  ✓ Elastic IP allocated: $ALLOCATION_ID"
        echo "  >>> Associate it manually from AWS Console"
        EIP="<ASSOCIATE_MANUALLY>"
    else
        echo "  ✓ Elastic IP allocated: $EIP"
    fi
fi
echo ""

# ============================================
# Step 5: Get Security Group ID
# ============================================
echo "--- Step 5: Security Group ---"

INSTANCE_ID="$(curl -s --max-time 10 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")"
if [[ -n "$INSTANCE_ID" ]]; then
    SG_ID="$(aws ec2 describe-instances --region "$REGION" \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
    echo "  Security Group: $SG_ID"
else
    echo "  Cannot determine Security Group (not on EC2 instance)"
    echo "  Get it from: aws ec2 describe-instances --instance-ids <ID>"
fi
echo ""

# ============================================
# Summary
# ============================================
echo "=========================================="
echo "  SETUP COMPLETE"
echo "=========================================="
echo ""
echo "GitHub Environment 'staging' — configure these values:"
echo ""
echo "Secrets:"
echo "  DEPLOY_HOST=$EIP"
echo "  DEPLOY_USER=ubuntu"
echo "  EC2_INSTANCE_ID=$INSTANCE_ID"
echo ""
echo "Variables:"
echo "  DEPLOY_PATH=/opt/elitedom"
echo "  SITE_URL=https://staging.elitedom.store"
echo "  API_URL=https://api.staging.elitedom.store"
echo "  AWS_REGION=$REGION"
echo "  AWS_ROLE_TO_ASSUME=$ROLE_ARN"
echo "  EC2_SECURITY_GROUP_ID=$SG_ID"
echo ""
echo "After Elastic IP is associated:"
echo "  1. ssh-keyscan -t ed25519,ecdsa,rsa $EIP"
echo "  2. Add DNS records pointing to $EIP"
echo "  3. Configure NPM proxy hosts"
echo "  4. Deploy via GitHub Actions"
