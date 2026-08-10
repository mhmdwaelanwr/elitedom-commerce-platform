---
title: "Deployment Guide"
status: current
owner: operations
document_type: operations
verified_against: "P24 staging readiness and qualified auto-promotion contract"
review_trigger: "Deployment workflow, host topology, AWS access, SSH ingress, backup/migration sequence, launch smoke, release-state, or environment contract changes."
---

# Deployment Guide

## Purpose

Defines the controlled release path from a green immutable commit to hardened staging and production Docker Compose environments. Repository CI qualifies code; protected GitHub Environments, host preflight, exact-SHA deployment, public launch smoke and environment-specific evidence control promotion.

## Environment topology

The currently provisioned AWS EC2 host is the **staging** target. It uses the hardened production-like Compose overlay while the runtime identity is `ENVIRONMENT=staging`. A future production environment must use a separate host and separate provider/data credentials.

The staging Git root is `/opt/elitedom`. `DEPLOY_PATH` must therefore be `/opt/elitedom`, not `/opt/elitedom/elitedom-store`. The host-local `.env` remains `/opt/elitedom/elitedom-store/.env` and is never uploaded or overwritten by the deployment workflow.

Do not use an auto-assigned EC2 public IPv4 as the long-term `DEPLOY_HOST`. Associate a stable Elastic IP or an equivalently stable network identity first, then pin the SSH host identity for that stable target.

## Release qualification and automatic staging promotion

`.github/workflows/staging-auto-deploy.yml` listens for a completed `Real Stack E2E` run on `main`. It promotes only when all of these conditions are true:

- the qualification workflow concluded successfully;
- the qualification event was a `push`, not a pull request;
- the qualified branch was `main`;
- repository variable `STAGING_AUTO_DEPLOY_ENABLED` is exactly `true`.

The promoted `release_ref` is `github.event.workflow_run.head_sha`; it is not recalculated from a moving branch name. Production is never an automatic target.

Keep `STAGING_AUTO_DEPLOY_ENABLED=false` or unset during first commissioning. Perform one successful manual staging deployment and chained public smoke before enabling automatic promotion.

## Deployment entry point

`.github/workflows/deploy.yml` supports both reusable `workflow_call` execution and manual `workflow_dispatch`. Manual dispatch remains the fallback for staging and the normal controlled path for production.

The workflow checks out deployment tooling from the exact requested 40-character `release_ref`, verifies that checked-out `HEAD` equals that SHA, fetches `main`, and proves the SHA is reachable from `origin/main` before any host access.

The normal deployment path remains **forward-only** after the first successful release is recorded. An older release requires the explicit rollback/recovery procedure rather than bypassing deployment state.

## Protected GitHub Environment contract

The lowercase GitHub Environment name for this host is `staging`.

Environment secrets:

- `DEPLOY_HOST` — stable Elastic IP or stable hostname after the EC2 address is fixed;
- `DEPLOY_USER` — deployment SSH user, currently `ubuntu`;
- `DEPLOY_SSH_PRIVATE_KEY` — dedicated deployment identity private key, never the operator's general-purpose key;
- `DEPLOY_KNOWN_HOSTS` — pinned OpenSSH host-key line for the stable deployment target.

Environment variables:

- `DEPLOY_PATH=/opt/elitedom`;
- `SITE_URL` — final public HTTPS staging storefront origin;
- `API_URL` — final public HTTPS staging API origin without `/api/v1`;
- `MANAGE_SSH_INGRESS=true` for the current EC2 security-group model;
- `AWS_DEPLOY_ROLE_ARN` — least-privilege GitHub OIDC role used only for temporary SSH ingress management;
- `AWS_REGION=eu-central-1`;
- `DEPLOY_SECURITY_GROUP_ID` — the exact security group attached to the staging EC2 instance.

Repository variable:

- `STAGING_AUTO_DEPLOY_ENABLED=false` until first commissioning succeeds; change to `true` only when automatic qualified staging promotion is desired.

Provider/application/database secrets remain in the host `.env` or an approved secret manager. They are not copied into GitHub deployment artifacts.

## Dedicated SSH deployment identity

Create a dedicated Ed25519 deployment key out of band. Add only its public key to the `ubuntu` account's `authorized_keys`; store only its private key in the `staging` Environment secret `DEPLOY_SSH_PRIVATE_KEY`.

After the Elastic IP or stable hostname is assigned, independently verify the EC2 SSH host-key fingerprint and then save the corresponding known-hosts line as `DEPLOY_KNOWN_HOSTS`. The workflow deliberately does not trust runtime `ssh-keyscan` output.

## GitHub OIDC and temporary SSH ingress

GitHub-hosted runners do not have one stable source IP suitable for the existing operator-only SSH rule. P24 therefore avoids a broad GitHub IP allowlist.

When `MANAGE_SSH_INGRESS=true`, the deployment job requests a short-lived GitHub OIDC token (`id-token: write`) and uses `aws-actions/configure-aws-credentials@v6` to assume `AWS_DEPLOY_ROLE_ARN`. No long-lived AWS access key is required in GitHub.

The workflow obtains the current runner IPv4 from AWS's check-IP endpoint, validates it as IPv4, creates exactly one TCP/22 ingress rule for `${runner_ip}/32`, captures the returned `SecurityGroupRuleId`, performs SSH preflight/deployment, then uses an `always()` cleanup step to revoke that exact rule ID. The operator's existing SSH rule is not modified.

The AWS role should be limited to authorizing and revoking ingress on the one staging security group. It does not need EC2 instance lifecycle, IAM, database or secret permissions.

The repository OIDC settings currently report the immutable repository prefix:

```text
repo:mhmdwaelanwr@179792006/elitedom-erp-architecture@1324616964
```

Because the deploy job references GitHub Environment `staging`, the AWS trust policy should bind the `sub` condition to:

```text
repo:mhmdwaelanwr@179792006/elitedom-erp-architecture@1324616964:environment:staging
```

and bind the audience to `sts.amazonaws.com`. Create the GitHub OIDC identity provider in AWS for `https://token.actions.githubusercontent.com` if it does not already exist.

A minimal deployment-role permissions policy can scope ingress mutation to the exact staging security group ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress"
      ],
      "Resource": "arn:aws:ec2:eu-central-1:AWS_ACCOUNT_ID:security-group/DEPLOY_SECURITY_GROUP_ID"
    }
  ]
}
```

Replace the account and security-group placeholders in AWS; do not commit those environment-specific values here.

## Host preflight

`elitedom-store/infrastructure/scripts/preflight_host.sh` is intentionally non-mutating. The workflow copies it to `/tmp`, runs it before deployment, retains `preflight.log`, and removes the temporary script.

The preflight validates at minimum:

- supported Linux/Ubuntu-Debian x86_64 host;
- CPU, RAM and free-disk floor;
- Git, Docker, Compose and `compose wait` availability;
- Docker daemon access for the deployment user;
- `/opt/elitedom` is the full non-shallow canonical Git checkout and tracked files are clean;
- `.env` is a non-symlink regular file with mode `600` or `640`;
- `.env ENVIRONMENT` exactly matches the protected GitHub Environment;
- `DEBUG=false`, staff MFA, Redis rate limiting and trusted-proxy configuration;
- strong core secret presence without printing secret values;
- `ALLOWED_HOSTS` includes `127.0.0.1` and `localhost` for container health checks;
- public staging CORS/API host agreement when final HTTPS origins are supplied;
- hardened Compose `config --quiet` succeeds;
- deployment state/backup directories are not unsafe symlinks and use strict permissions when present;
- PostgreSQL, Redis, FastAPI, Odoo, frontend and admin-tool ports are not publicly published.

The preflight never installs packages, edits `.env`, restarts services, changes firewall rules or removes volumes.

## Required host configuration before first official staging deploy

The current manually bootstrapped host must be deliberately converted from its temporary production identity to staging before P24 deployment is commissioned:

- set host `.env` `ENVIRONMENT=staging`;
- keep `DEBUG=false`, `STAFF_MFA_REQUIRED=true` and `RATE_LIMIT_BACKEND=redis`;
- keep `127.0.0.1,localhost` in `ALLOWED_HOSTS` and add the final staging API hostname;
- set `CORS_ORIGINS` to include the final HTTPS staging storefront origin;
- set `VITE_SITE_URL` and `VITE_API_URL` to the final public HTTPS staging origins;
- retain the existing strong local secrets and file mode;
- do not enable a provider until its staging credentials and callback URLs are ready.

P24's hardened Compose overlay passes the `ENVIRONMENT` value through to FastAPI and Celery while preserving non-development security controls.

## Guarded remote deployment sequence

`elitedom-store/infrastructure/scripts/deploy_release.sh` performs the following sequence:

1. validate exact Git SHA, origins, tools, full clone and clean tracked tree;
2. verify the requested SHA is reachable from `origin/main` and is forward from the recorded successful release when state exists;
3. check out exactly the requested commit in detached-HEAD mode;
4. validate `.env` permissions and require its environment identity to match `staging` or `production` from the protected workflow;
5. validate hardened Compose without overwriting host configuration;
6. start/wait for PostgreSQL and application DB initialization;
7. create and gzip-test pre-migration application/Odoo backups outside the checkout;
8. build the immutable FastAPI/frontend/Celery release images;
9. run `alembic upgrade head`;
10. upgrade `elitedom_connector`;
11. start the topology with bounded `--wait` health checking;
12. run the Odoo integration smoke;
13. verify checkout SHA again and atomically record it in `.elitedom-deployment-state/release_ref`.

The deployer does not run database downgrade, automatic restore, `git reset --hard`, `git clean`, `.env` replacement or volume deletion.

## Public post-deployment gate

A successful remote deployment automatically invokes `.github/workflows/launch-smoke.yml` for the same `SITE_URL`, `API_URL` and `release_ref`. Public HTTPS provenance, liveness/readiness, catalog/media quality and browser launch checks must pass before that deployment counts as staging evidence.

## Backup restore drill

Deployment-time dumps prove that backups can be created and gzip-decoded, but they do not prove recoverability. Use `elitedom-store/infrastructure/scripts/restore_drill.sh` with one application and one Odoo `.sql.gz` backup.

The drill validates both gzip streams, creates a disposable PostgreSQL 15 container with `--network none`, uses a dedicated temporary volume, restores into two isolated drill databases, verifies user tables, and removes only the drill container/volume. It never loads the live `.env`, attaches to the live Compose project or calls the destructive `restore.sh` recovery helper.

## First staging commissioning order

1. Associate an Elastic IP with the staging EC2 instance.
2. Confirm SSH from the operator path still works and independently verify the host-key fingerprint for the stable target.
3. Create the dedicated deployment SSH identity and install only its public key on the host.
4. Create/configure the AWS GitHub OIDC provider and least-privilege staging security-group role.
5. Set the `staging` GitHub Environment secrets/variables above while leaving `STAGING_AUTO_DEPLOY_ENABLED=false`.
6. Configure staging DNS records to the Elastic IP and obtain TLS certificates through the reverse proxy.
7. Update the existing host `.env` in place to `ENVIRONMENT=staging` plus the final DNS/CORS/Vite origins; do not replace the file.
8. Manually dispatch `Deploy Release` for the latest successful P23/P24-qualified main SHA.
9. Require remote preflight, guarded deploy and public Launch Smoke to all pass for that SHA.
10. Run human staging UAT, provider acceptance as providers are enabled, monitoring/alert verification and the isolated restore drill.
11. Enable repository variable `STAGING_AUTO_DEPLOY_ENABLED=true` only after the commissioning run is accepted.

## Source of truth

- `.github/workflows/deploy.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/launch-smoke.yml`
- `.github/workflows/deployment-contract.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `docs/operations/infrastructure/ENVIRONMENTS.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

PR CI validates the workflow/scripts/Compose contract without a live host. Environment evidence requires an actual protected deployment, retained preflight/deployment logs, exact-SHA public launch smoke, provider/human UAT and recovery evidence. Repository validation must never be presented as proof that a live staging deployment occurred.

## Change policy

Update this document in the same pull request as changes to deployment execution, automatic promotion, AWS/OIDC/SSH ingress, environment variables/secrets, host preflight, backup/restore behavior, launch-smoke chaining, release-state behavior or rollback boundaries.
