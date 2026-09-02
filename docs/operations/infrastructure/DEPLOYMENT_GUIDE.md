---
title: "Deployment Guide"
status: current
owner: operations
document_type: operations
verified_against: "P24 exact-SHA staging promotion and protected EC2 Instance Connect deployment"
review_trigger: "Deployment workflow, VPS topology, backup/migration sequence, launch smoke, release-state, staging promotion, or environment contract changes."
---

# Deployment Guide

## Purpose

Defines the implemented release path from a green immutable commit to the existing single-VPS Docker Compose environment. Repository CI proves deployability; protected GitHub Environments and the remote deployment script control environment-specific execution.

## Deployment entry point

Use `.github/workflows/deploy.yml` with `workflow_dispatch`. Select `staging` or `production` and provide the full 40-character Git `release_ref`. The commit must exist and be reachable from `main`.

After the first staging commissioning succeeds, `.github/workflows/staging-auto-deploy.yml` can promote a qualified `main` release automatically after `Real Stack E2E` completes successfully. This path is opt-in and remains disabled unless repository variable `STAGING_AUTO_DEPLOY_ENABLED` equals `true`. The promoter passes the exact qualifying workflow `head_sha`; it never deploys a moving branch ref.

The normal deployment path is **forward-only** after the first successful protected deployment. The deployer persists the exact last-successful release SHA outside the repository checkout and refuses to move that environment to an older commit. An application rollback is therefore an explicit recovery procedure, not an accidental use of the normal deploy workflow.

Each GitHub Environment must define these environment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KNOWN_HOSTS` — pinned OpenSSH known-hosts content; runtime `ssh-keyscan` is intentionally not trusted.
- `EC2_INSTANCE_ID` — target instance used by EC2 Instance Connect.

Each GitHub Environment must define these non-secret variables:

- `DEPLOY_PATH` — absolute path of the existing repository checkout on the VPS.
- `SITE_URL` — public HTTPS storefront origin.
- `API_URL` — public HTTPS API origin, without `/api/v1`.
- `AWS_REGION` — AWS region for OIDC credentials, EC2 Instance Connect, and security-group operations.
- `AWS_ROLE_TO_ASSUME` — IAM role assumed by GitHub Actions through OIDC.
- `EC2_SECURITY_GROUP_ID` — security group whose temporary runner SSH rule is managed by the workflow.
- `REQUIRE_ODOO_SMOKE` — environment policy for the post-deploy Odoo smoke.

A persistent deployment private key is not part of the current contract. The workflow generates an ephemeral Ed25519 key pair for each run and sends only the public key through EC2 Instance Connect.

Production approval/reviewer rules belong on the GitHub `production` Environment. The workflow itself does not bypass Environment approval.

## Remote host and AWS contract

The deployment user must be able to run Git and Docker Compose v2, access the configured repository, and operate the Elitedom Compose project. The deployment checkout must be a full Git repository rather than a shallow clone because release ancestry is a safety boundary. `elitedom-store/.env` stays on the host, must not be a symlink, and must have mode `600` or `640`. The workflow never copies production provider credentials into GitHub artifacts.

GitHub Actions obtains AWS credentials through OIDC using `AWS_ROLE_TO_ASSUME`. The role must allow the narrowly required EC2 Instance Connect and security-group operations for the configured staging/production target. The workflow determines the runner public IPv4, opens SSH only for that `/32`, generates an ephemeral SSH key, pushes the public key through EC2 Instance Connect, and revokes the temporary security-group rule after execution. SSH still requires the pinned host identity in `DEPLOY_KNOWN_HOSTS` with strict host checking enabled.

The deployer rejects tracked local modifications before changing the checkout. It fetches `origin/main`, verifies the requested commit again on the VPS, then checks out the exact commit in detached-HEAD mode. Untracked production configuration is not deleted.

After a successful deployment, the deployer atomically records the release SHA in the sibling directory `.elitedom-deployment-state/release_ref`. The directory is outside the Git checkout, the state path must not be a symlink, and the recorded value must be a full Git SHA before it can participate in a later ancestry decision. The state file is written only after Compose health and the Odoo integration smoke succeed.

On the first protected deployment, no last-successful state exists and the run is treated as a bootstrap. Once state exists, a later normal deployment must satisfy `last_successful_release -> requested_release` Git ancestry. If the requested commit is older or on an incompatible line, deployment stops before checkout/build/migration and directs the operator to the controlled rollback procedure.

## Implemented sequence

`.github/workflows/deploy.yml` and `elitedom-store/infrastructure/scripts/deploy_release.sh` perform the controlled deployment in this order:

1. check out deployment tooling at the exact requested release SHA and prove repository HEAD equals it;
2. verify the release is a full Git SHA reachable from `main`, validate the Environment contract, and validate HTTPS target origins;
3. obtain AWS credentials through GitHub OIDC;
4. identify the runner public IPv4, authorize temporary SSH ingress for that `/32`, generate an ephemeral SSH key, push the public key through EC2 Instance Connect, and configure strict pinned-host SSH;
5. verify the remote host exposes Git and Docker Compose v2;
6. validate the Git origin, full non-shallow repository, immutable SHA, Docker/Compose availability, and production `.env` permissions;
7. read and validate the last-successful deployment state when one exists, verify the requested release is on `main`, and enforce the forward-only normal deployment boundary;
8. validate the production Compose topology with `config --quiet`;
9. start/wait for PostgreSQL and application DB initialization;
10. resolve the application and Odoo database names from the Compose service environments;
11. dump any pre-existing application and Odoo databases to an external sibling backup directory, gzip them, and run `gzip -t` before migration;
12. build FastAPI, frontend, Celery worker, and Celery beat images for the requested source revision;
13. run `alembic upgrade head` before traffic cutover;
14. upgrade the bundled `elitedom_connector` in Odoo;
15. start the production topology with Compose `--wait` and a bounded timeout;
16. run the repository Odoo integration smoke, verify the checkout still equals the requested SHA, then atomically record the new last-successful release and capture `docker compose ps` evidence;
17. revoke the temporary SSH ingress rule and preserve deployment evidence;
18. only after remote deployment succeeds, run the reusable Launch Smoke against the same exact release.

The script does **not** run `alembic downgrade`, `restore.sh`, `git reset --hard`, or `git clean`. A failed deployment therefore stops for operator assessment instead of automatically rewriting durable state. A failed run also does not advance `.elitedom-deployment-state/release_ref`, so the next promotion still compares against the last release that completed runtime verification.

## First staging commissioning

Keep `STAGING_AUTO_DEPLOY_ENABLED` disabled for the first staging deployment. Commission staging manually with `.github/workflows/deploy.yml` using the exact qualified `main` SHA and the protected `staging` Environment. Before enabling automatic promotion, capture evidence that:

- the Environment secrets and AWS/OIDC variables resolve correctly;
- EC2 Instance Connect reaches the intended instance and the pinned SSH host key matches;
- temporary SSH ingress is runner-IP `/32` scoped and revoked after the run;
- the remote checkout, `.env`, Compose topology, database backups, migrations, Odoo upgrade, and health checks succeed;
- public `SITE_URL` and `API_URL` resolve over HTTPS and Launch Smoke passes for the same release SHA;
- monitoring and recovery ownership for staging are known.

Only after that commissioning evidence exists should `STAGING_AUTO_DEPLOY_ENABLED=true` be considered.

## Post-deployment gate

A successful remote deployment automatically calls the reusable `.github/workflows/launch-smoke.yml`. That gate verifies public HTTPS liveness/readiness, exact deployed `release_ref`, complete public catalogue/media quality, responsive browser behavior, real guest cart/checkout rendering, and launch evidence without submitting payment/order side effects.

A deployment is not considered release-ready merely because the SSH step succeeded; the called launch smoke must also pass for the same release reference.

## Evidence and rollback

The deployment workflow preserves `deployment.log` for 30 days. The launch workflow separately preserves smoke, release-provenance, Playwright report, and failure trace/screenshot/video evidence.

Database backups remain on the deployment host outside the repository by default. Do not automatically restore them on application failure. Use the Go-Live Runbook and recovery procedure to decide whether application rollback, schema compatibility handling, or a controlled restore is appropriate.

Do not bypass the forward-only deploy guard by editing `.elitedom-deployment-state/release_ref` to an older SHA. If rollback is required, preserve the recorded last-successful release as evidence and perform an explicit compatibility assessment for the application schema, Odoo addon state, provider/webhook configuration, and any data written since the failed/newer release.

## Source of truth

- `.github/workflows/deploy.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/launch-smoke.yml`
- `.github/workflows/deployment-contract.yml`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

PR CI runs the deployment-contract validator and shell syntax check. Repository CI also qualifies the exact code through Real Stack E2E. Real Environment credentials, AWS permissions, target identity, DNS/TLS, and remote-host state can only be proven by a protected deployment. First staging commissioning is manual; qualified staging auto-promotion is opt-in after commissioning and remains guarded by the same reusable deployment workflow.

## Change policy

Update this document in the same pull request as changes to deployment execution, environment variables/secrets, AWS/OIDC access, staging promotion, backup-before-migration behavior, launch-smoke chaining, release-state behavior, or rollback boundaries.
