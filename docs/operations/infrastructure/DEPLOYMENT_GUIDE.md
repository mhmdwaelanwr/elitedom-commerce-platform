---
title: "Deployment Guide"
status: current
owner: operations
document_type: operations
verified_against: "P16 protected deployment execution"
review_trigger: "Deployment workflow, VPS topology, backup/migration sequence, launch smoke, or environment contract changes."
---

# Deployment Guide

## Purpose

Defines the implemented release path from a green immutable commit to the existing single-VPS Docker Compose environment. Repository CI proves deployability; protected GitHub Environments and the remote deployment script control environment-specific execution.

## Deployment entry point

Use `.github/workflows/deploy.yml` with `workflow_dispatch`. Select `staging` or `production` and provide the full 40-character Git `release_ref`. The commit must exist and be reachable from `main`.

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

The deployment user must be able to run Git and Docker Compose v2, access the configured repository, and operate the Elitedom Compose project. `elitedom-store/.env` stays on the host, must not be a symlink, and must have mode `600` or `640`. The workflow never copies production provider credentials into GitHub artifacts.

The deployer rejects tracked local modifications before changing the checkout. It fetches `origin/main`, verifies the requested commit again on the VPS, then checks out the exact commit in detached-HEAD mode. Untracked production configuration is not deleted.

## Implemented sequence

`elitedom-store/infrastructure/scripts/deploy_release.sh` performs the deployment in this order:

1. validate the Git origin, immutable SHA, HTTPS target origins, Docker/Compose availability, and production `.env` permissions;
2. validate the production Compose topology with `config --quiet`;
3. start/wait for PostgreSQL and application DB initialization;
4. resolve the application and Odoo database names from the Compose service environments;
5. dump any pre-existing application and Odoo databases to an external sibling backup directory, gzip them, and run `gzip -t` before migration;
6. build FastAPI, frontend, Celery worker, and Celery beat images for the requested source revision;
7. run `alembic upgrade head` before traffic cutover;
8. upgrade the bundled `elitedom_connector` in Odoo;
9. start the production topology with Compose `--wait` and a bounded timeout;
10. run the repository Odoo integration smoke and record `docker compose ps` evidence.

The script does **not** run `alembic downgrade`, `restore.sh`, `git reset --hard`, or `git clean`. A failed deployment therefore stops for operator assessment instead of automatically rewriting durable state.

## Post-deployment gate

A successful remote deployment automatically calls the reusable `.github/workflows/launch-smoke.yml`. That gate verifies public HTTPS liveness/readiness, exact deployed `release_ref`, complete public catalogue/media quality, responsive browser behavior, real guest cart/checkout rendering, and launch evidence without submitting payment/order side effects.

A deployment is not considered release-ready merely because the SSH step succeeded; the called launch smoke must also pass for the same release reference.

## Evidence and rollback

The deployment workflow preserves `deployment.log` for 30 days. The launch workflow separately preserves smoke, release-provenance, Playwright report, and failure trace/screenshot/video evidence.

Database backups remain on the deployment host outside the repository by default. Do not automatically restore them on application failure. Use the Go-Live Runbook and recovery procedure to decide whether application rollback, schema compatibility handling, or a controlled restore is appropriate.

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

Update this document in the same pull request as changes to deployment execution, environment variables/secrets, backup-before-migration behavior, launch-smoke chaining, or rollback boundaries.
