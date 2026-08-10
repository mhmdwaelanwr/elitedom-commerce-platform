---
title: "P24 Staging Readiness"
status: current
owner: operations
document_type: release-reference
verified_against: "P24 staging readiness and qualified auto-promotion contract"
review_trigger: "Staging host commissioning, exact-SHA promotion, AWS OIDC/SSH, DNS/TLS, restore evidence, or environment boundary changes."
---

# P24 — Staging Readiness & Qualified Auto Deployment

## Purpose

Records the repository-side readiness boundary for commissioning the existing AWS staging host without repeating or destructively replacing its manual bootstrap.

## Environment decision

The currently provisioned EC2 host is designated **staging**. It uses the same hardened Compose overlay intended for production-like execution, but its runtime identity must be `ENVIRONMENT=staging`. Future production uses a separate host/GitHub Environment and separate provider/data credentials.

The canonical Git checkout on the staging host is `/opt/elitedom`; the deployment workflow therefore requires `DEPLOY_PATH=/opt/elitedom`. The existing host `.env` remains local, is not copied into Git, and is never overwritten by P24 automation.

## What P24 implements

- parameterized hardened Compose identity for `staging` and `production` without reducing `DEBUG=false`, staff MFA or Redis rate-limiting controls;
- a read-only `preflight_host.sh` for already-provisioned hosts;
- exact-SHA deployment tooling checkout and environment-identity validation before remote mutation;
- reusable/manual deployment plus an optional automatic staging promoter;
- automatic staging promotion only from a successful `Real Stack E2E` run caused by a push to `main`;
- exact promotion of `workflow_run.head_sha`, not a moving branch reference;
- GitHub OIDC short-lived AWS credentials for temporary runner SSH access;
- one temporary TCP/22 rule limited to the current runner IPv4 `/32`, revoked by exact security-group rule ID in cleanup;
- a non-destructive application/Odoo restore drill using an isolated PostgreSQL container and disposable volume;
- expanded deployment-contract validation and operational documentation.

## What P24 deliberately does not do

P24 does not:

- allocate or associate an Elastic IP;
- edit the AWS security group outside a deployment run's temporary runner rule;
- overwrite or regenerate the host `.env`;
- expose database, Redis, FastAPI, Odoo or admin-tool ports publicly;
- run `docker compose down -v`;
- automatically restore or downgrade databases;
- create provider credentials;
- create DNS records or issue TLS certificates;
- claim that staging has been deployed merely because repository CI is green.

## Automatic promotion gate

`.github/workflows/staging-auto-deploy.yml` remains disabled unless repository variable `STAGING_AUTO_DEPLOY_ENABLED=true`. When enabled, it calls the guarded deployment workflow only after the main-branch Real Stack E2E workflow finishes successfully and passes that qualification run's exact SHA as `release_ref`.

Production is not an automatic target. Manual `workflow_dispatch` remains available for controlled staging fallback and production promotion.

## Current commissioning blockers

Before the first official P24 staging deployment, environment-specific work remains:

1. associate a stable EC2 Elastic IP or equivalent stable network identity;
2. establish the dedicated deployment SSH identity and pin the stable target's verified SSH host key;
3. create/configure the AWS GitHub OIDC provider and least-privilege role for temporary ingress on the one staging security group;
4. populate the existing lowercase `staging` GitHub Environment with required deployment secrets/variables;
5. configure final public staging DNS and TLS;
6. edit the existing host `.env` in place so `ENVIRONMENT=staging` and public host/CORS/Vite origins match the final HTTPS endpoints;
7. manually deploy the latest successful P23/P24-qualified main SHA once for commissioning;
8. require preflight, remote deployment and chained public HTTPS Launch Smoke to pass for the same SHA;
9. complete human/provider/monitoring/recovery evidence before treating staging as accepted;
10. enable `STAGING_AUTO_DEPLOY_ENABLED=true` only after the manual commissioning run is accepted.

## Recovery evidence

Deployment already creates pre-migration application/Odoo backups. P24 adds `restore_drill.sh` so retained dumps can be restored safely without targeting live databases. A drill pass verifies SQL materialization and user-table presence; it does not replace later functional/provider/rollback validation.

## Source of truth

- `.github/workflows/real-e2e.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deployment-contract.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `docs/operations/infrastructure/ENVIRONMENTS.md`
- `docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Repository CI must pass deployment-contract validation, standard application checks, documentation hygiene and Real Stack E2E/P23 UAT on the P24 code. Live staging readiness requires separate environment evidence from the protected deployment and public smoke; this release reference does not substitute for that evidence.

## Change policy

Update this record while P24 remains the current staging-readiness contract. Once live staging commissioning occurs, preserve the repository-side qualification boundary and add environment-specific evidence rather than rewriting repository CI as if it had performed the external work.
