---
title: "P24 Staging Readiness"
status: current
owner: operations
document_type: release-reference
verified_against: "P24 qualified staging promotion contract"
review_trigger: "Staging deployment, qualification, SSH identity, DNS/TLS, provider acceptance, restore evidence, or environment boundaries change."
---

# P24 — Staging Readiness & Qualified Promotion

## Purpose

Defines the repository-side boundary for promoting a fully qualified `main` commit into the protected `staging` GitHub Environment. It does not claim that an external staging host is commissioned merely because repository CI is green.

## Qualification and promotion model

A staging candidate is eligible for automatic promotion only when the `Real Stack E2E` workflow completes successfully for a push to `main`. The promoter passes that workflow run's immutable `head_sha` into the same guarded deployment workflow used for manual releases.

Automatic staging remains disabled unless repository variable `STAGING_AUTO_DEPLOY_ENABLED=true`. Production is never an automatic target and remains an explicit operator-controlled deployment.

## Deployment security boundary

The reusable deployment workflow preserves the existing EC2 security model:

- AWS access uses GitHub OIDC rather than stored AWS access keys;
- SSH ingress is temporarily opened only for the current GitHub-hosted runner IPv4 `/32`;
- the temporary ingress rule is identified and revoked during cleanup;
- EC2 Instance Connect installs an ephemeral public key for each deployment attempt;
- `DEPLOY_KNOWN_HOSTS` pins the target SSH host identity;
- `StrictHostKeyChecking yes` rejects unknown or changed host keys instead of learning them during a release;
- deployment tooling is checked out at the exact requested `release_ref` and verifies that `HEAD` matches that SHA;
- the release SHA must be reachable from `main` before remote mutation begins.

## Required protected staging configuration

The `staging` GitHub Environment must provide the deployment values required by `.github/workflows/deploy.yml`, including the target host/user/EC2 identity, pinned `DEPLOY_KNOWN_HOSTS`, deployment path, HTTPS storefront/API origins, AWS region/role, and the target security group.

Provider, database, Redis, application, Odoo, and other runtime credentials remain protected environment/host configuration and must never be copied into repository documentation or workflow logs.

## What repository automation proves

For a qualified release SHA, repository automation can prove:

- repository hygiene and documentation contracts;
- backend/frontend/container/migration/Odoo checks;
- Real Stack P22 browser integration and P23 responsive/RTL/theme/role UAT;
- immutable release selection;
- protected deployment workflow structure;
- strict SSH host verification and ephemeral runner access design;
- chained public launch-smoke execution after a successful deployment.

## What still requires environment evidence

Before staging is treated as accepted, operators still need environment-specific evidence for:

- stable public network identity and DNS;
- valid HTTPS/TLS for storefront and API;
- successful protected deployment of the exact qualified SHA;
- public liveness/readiness and browser launch smoke;
- Paymob and other enabled provider acceptance;
- Odoo round-trip behavior against the staging environment;
- monitoring and alert routing;
- backup restore drill evidence;
- human English/Arabic responsive/accessibility review;
- rollback ownership and recovery readiness.

`STAGING_AUTO_DEPLOY_ENABLED` should only be enabled after the first manual staging commissioning run has passed these infrastructure-level prerequisites and the team is comfortable promoting every qualified `main` SHA automatically.

## Source of truth

- `.github/workflows/real-e2e.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deployment-contract.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Change policy

Keep automatic promotion staging-only, exact-SHA, qualification-gated, and opt-in. Any change that weakens host identity pinning, release provenance, temporary access cleanup, environment protection, or the Real Stack qualification boundary must update this record and the executable deployment contract in the same pull request.
