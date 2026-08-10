---
title: "Environment Model"
status: current
owner: operations
document_type: operations
verified_against: "P24 staging readiness and qualified auto-promotion contract"
review_trigger: "Environment identity, hardened Compose behavior, staging topology, or promotion boundaries change."
---

# Environment Model

## Purpose

Defines the behavioral and operational boundaries between development, staging and production.

## Current state

`ENVIRONMENT` accepts `development`, `staging`, or `production`. Development permits local conveniences; staging and production activate the same fail-closed application safety validation while retaining distinct environment identities.

The hardened Compose overlay `elitedom-store/infrastructure/docker-compose.prod.yml` is intentionally shared by staging and production. It no longer forces the runtime to identify as production; it maps the host `ENVIRONMENT` value into FastAPI and Celery while preserving `DEBUG=false`, staff MFA and Redis-backed rate limiting.

The currently provisioned single-host target is designated **staging**. Production is a separate future host/GitHub Environment and must not reuse staging databases, provider credentials or launch evidence.

## Staging target contract

The current staging host is an Ubuntu 24.04 x86_64 EC2 instance in `eu-central-1` with a full repository checkout at `/opt/elitedom`. The host-local configuration remains at `/opt/elitedom/elitedom-store/.env`; deployment automation must not create or overwrite that file.

The public address is deliberately not recorded here because an automatically assigned EC2 public IPv4 is not a stable deployment identity. A stable address must be assigned before `DEPLOY_HOST` and pinned SSH host-key material are treated as final.

Before the first official staging deployment, the host `.env` must identify as `ENVIRONMENT=staging`, and its public origin-dependent values such as `ALLOWED_HOSTS`, `CORS_ORIGINS`, `VITE_SITE_URL` and `VITE_API_URL` must match the final staging DNS/TLS endpoints. Changing only GitHub Environment metadata does not rewrite host configuration.

## Invariants and controls

- Development may use debug, in-memory rate limiting and local media depending on config.
- Staging/production require `DEBUG=false`, strong distinct secrets, staff MFA and Redis rate limiting.
- Wildcard hosts/CORS are rejected outside development.
- Enabled integrations must satisfy their secure configuration contracts.
- S3/CDN URLs must be HTTPS outside development.
- The protected deployment target and host `.env` environment identity must match; mismatch blocks deployment.
- Staging data, provider credentials and acceptance evidence do not prove production readiness.
- Automatic promotion is staging-only and uses the exact SHA from a successful main-branch Real Stack E2E qualification run.
- Production deployment remains an explicit protected/manual promotion unless a future reviewed policy changes that boundary.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/.env.example`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `.github/workflows/deploy.yml`
- `.github/workflows/staging-auto-deploy.yml`

## Verification

Run `preflight_host.sh` against the intended target, validate the hardened Compose configuration, then deploy an exact qualified SHA through the protected workflow and require the chained public launch smoke to pass for that same SHA.

## Change policy

Update this document in the same pull request as any change that alters environment identity, host designation, hardened Compose behavior or release promotion policy.
