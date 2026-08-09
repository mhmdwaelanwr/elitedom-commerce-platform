---
title: "Deployment Guide"
status: current
owner: operations
document_type: operations
verified_against: "P16 protected deployment execution"
review_trigger: "Deployment workflow, VPS topology, backup/migration sequence, launch smoke, release-state, or environment contract changes."
---

# Deployment Guide

## Purpose

Defines the implemented release path from a green immutable commit to the existing single-VPS Docker Compose environment. Repository CI proves deployability; protected GitHub Environments and the remote deployment script control environment-specific execution.

## Deployment entry point

Use `.github/workflows/deploy.yml` with `workflow_dispatch`. Select `staging` or `production` and provide the full 40-character Git `release_ref`. The commit must exist and be reachable from `main`.

The normal deployment path is **forward-only** after the first successful P16 deployment. The deployer persists the exact last-successful release SHA outside the repository checkout and refuses to move that environment to an older commit. An application rollback is therefore an explicit recovery procedure, not an accidental use of the normal deploy workflow.

Each GitHub Environment must define these environment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_KNOWN_HOSTS` — pinned OpenSSH known-hosts content; runtime `ssh-keyscan` is intentionally not trusted.

Each GitHub Environment must define these non-secret variables:

- `DEPLOY_PATH` — absolute path of the existing repository checkout on the VPS.
- `SITE_URL` — public HTTPS storefront origin.
- `API_URL` — public HTTPS API origin, without `/api/v1`.

Production approval/reviewer rules belong on the GitHub `production` Environment. The workflow itself does not bypass Environment approval.

## Remote host contract

The deployment user must be able to run Git and Docker Compose v2, access the configured repository, and operate the Elitedom Compose project. The deployment checkout must be a full Git repository rather than a shallow clone because release ancestry is a safety boundary. `elitedom-store/.env` stays on the host, must not be a symlink, and must have mode `600` or `640`. The workflow never copies production provider credentials into GitHub artifacts.

The deployer rejects tracked local modifications before changing the checkout. It fetches `origin/main`, verifies the requested commit again on the VPS, then checks out the exact commit in detached-HEAD mode. Untracked production configuration is not deleted.

After a successful deployment, the deployer atomically records the release SHA in the sibling directory `.elitedom-deployment-state/release_ref`. The directory is outside the Git checkout, the state path must not be a symlink, and the recorded value must be a full Git SHA before it can participate in a later ancestry decision. The state file is written only after Compose health and the Odoo integration smoke succeed.

On the first P16 deployment, no last-successful state exists and the run is treated as a bootstrap. Once state exists, a later normal deployment must satisfy `last_successful_release -> requested_release` Git ancestry. If the requested commit is older or on an incompatible line, deployment stops before checkout/build/migration and directs the operator to the controlled rollback procedure.

## Implemented sequence

`elitedom-store/infrastructure/scripts/deploy_release.sh` performs the deployment in this order:

1. validate the Git origin, full non-shallow repository, immutable SHA, HTTPS target origins, Docker/Compose availability, and production `.env` permissions;
2. read and validate the last-successful deployment state when one exists, verify the requested release is on `main`, and enforce the forward-only normal deployment boundary;
3. validate the production Compose topology with `config --quiet`;
4. start/wait for PostgreSQL and application DB initialization;
5. resolve the application and Odoo database names from the Compose service environments;
6. dump any pre-existing application and Odoo databases to an external sibling backup directory, gzip them, and run `gzip -t` before migration;
7. build FastAPI, frontend, Celery worker, and Celery beat images for the requested source revision;
8. run `alembic upgrade head` before traffic cutover;
9. upgrade the bundled `elitedom_connector` in Odoo;
10. start the production topology with Compose `--wait` and a bounded timeout;
11. run the repository Odoo integration smoke, verify the checkout still equals the requested SHA, then atomically record the new last-successful release and capture `docker compose ps` evidence.

The script does **not** run `alembic downgrade`, `restore.sh`, `git reset --hard`, or `git clean`. A failed deployment therefore stops for operator assessment instead of automatically rewriting durable state. A failed run also does not advance `.elitedom-deployment-state/release_ref`, so the next promotion still compares against the last release that completed runtime verification.

## Post-deployment gate

A successful remote deployment automatically calls the reusable `.github/workflows/launch-smoke.yml`. That gate verifies public HTTPS liveness/readiness, exact deployed `release_ref`, complete public catalogue/media quality, responsive browser behavior, real guest cart/checkout rendering, and launch evidence without submitting payment/order side effects.

A deployment is not considered release-ready merely because the SSH step succeeded; the called launch smoke must also pass for the same release reference.

## Evidence and rollback

The deployment workflow preserves `deployment.log` for 30 days. The launch workflow separately preserves smoke, release-provenance, Playwright report, and failure trace/screenshot/video evidence.

Database backups remain on the deployment host outside the repository by default. Do not automatically restore them on application failure. Use the Go-Live Runbook and recovery procedure to decide whether application rollback, schema compatibility handling, or a controlled restore is appropriate.

Do not bypass the forward-only deploy guard by editing `.elitedom-deployment-state/release_ref` to an older SHA. If rollback is required, preserve the recorded last-successful release as evidence and perform an explicit compatibility assessment for the application schema, Odoo addon state, provider/webhook configuration, and any data written since the failed/newer release.

## Source of truth

- `.github/workflows/deploy.yml`
- `.github/workflows/launch-smoke.yml`
- `.github/workflows/deployment-contract.yml`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

PR CI runs the deployment-contract validator and shell syntax check. Real SSH deployment is intentionally manual and environment-protected because repository CI does not possess or infer deployment credentials.

## Change policy

Update this document in the same pull request as changes to deployment execution, environment variables/secrets, backup-before-migration behavior, launch-smoke chaining, release-state behavior, or rollback boundaries.
