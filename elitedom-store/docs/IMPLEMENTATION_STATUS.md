---
title: "Implementation Status"
status: current
owner: operations
document_type: implementation-reference
verified_against: "P24 staging readiness and qualified auto-promotion contract"
review_trigger: "Implementation Status behavior, evidence, environment commissioning, or source-of-truth changes."
---

# Implementation Status

## Purpose

Provides the concise current-state inventory for operators and engineers closest to the executable platform.

## Current state

The repository has delivered the governed application and release-control implementation through P24. P23 qualifies immutable release candidates in an isolated full stack; P24 adds existing-host preflight, staging/production environment identity enforcement, exact-qualified-SHA automatic staging promotion, short-lived AWS OIDC SSH ingress management and an isolated database restore drill.

A staging EC2 host has been provisioned externally, but repository evidence does **not** claim that P24 has been deployed to it yet. Stable addressing, final staging DNS/TLS, GitHub/AWS deployment credentials, host environment identity conversion, public HTTPS smoke and provider/human/recovery evidence remain commissioning work.

## Invariants and controls

- Implemented: bilingual/theme-aware React/Vite storefront and administration surfaces, account/cart/checkout/catalog, order tracking, warranty/RMA, B2B/RFQ, inventory, suppliers, dropshipping, reports and catalogue administration.
- Implemented: phone/social auth/session foundations, staff MFA, RBAC/permissions/audit and explicit auth-state durability before reusable credentials or MFA state are returned.
- Implemented: Paymob primary integration with verified callbacks/state/refund foundations; Stripe legacy compatibility remains isolated. Customer-facing payment choices remain gateway-brand agnostic.
- Implemented: Odoo 17 connector with signed/idempotent catalogue/inventory/order/shipment delivery and retry/outbox behavior.
- Implemented: content/media administration, S3/CDN option, readiness/metrics/security hardening, SEO, protected exact-SHA deployment and forward-only environment promotion.
- Implemented: real-stack browser integration against React/Vite + FastAPI + PostgreSQL + Redis/Celery + Odoo 17 without application API mocking.
- Implemented: P23 production-like UAT at 360x800, 390x844, 430x932 and 1024x768 across AR/EN, RTL/LTR, light/dark and customer/B2B/admin role surfaces.
- Implemented: immutable release-candidate qualification manifest tied to the exact 40-character Git SHA, liveness/readiness evidence and passing P22/P23 Playwright reports.
- Implemented in P24: hardened Compose preserves `staging` versus `production` identity while keeping non-development fail-closed controls.
- Implemented in P24: `preflight_host.sh` audits an existing host without installing, editing, restarting or deleting durable resources.
- Implemented in P24: the protected deployer refuses a host `.env` whose `ENVIRONMENT` differs from the selected GitHub Environment and never overwrites that file.
- Implemented in P24: successful `Real Stack E2E` on a `main` push can promote that exact SHA automatically to `staging`, gated by `STAGING_AUTO_DEPLOY_ENABLED`; production remains non-automatic.
- Implemented in P24: GitHub OIDC can assume a least-privilege AWS role, authorize one temporary TCP/22 runner IPv4 `/32` rule and revoke that exact security-group rule after SSH work.
- Implemented in P24: `restore_drill.sh` restores application and Odoo dumps into an isolated disposable PostgreSQL target without touching live Compose or live volumes.
- Environment-dependent: assign stable EC2 addressing, finish staging GitHub Environment/OIDC/SSH values, change the existing host identity to `ENVIRONMENT=staging`, configure final DNS/TLS/origins, run the first official protected deployment and public smoke, then enable auto-deploy if accepted.
- Launch-dependent: staging Paymob/Google/Apple/Twilio/email/Odoo provider acceptance, monitoring/alert routing, human UX/accessibility UAT, restore/rollback evidence and later separate production commissioning.
- Planned/non-current: Typeform adapter, Zoho runtime adapter and production Hedera submission.

## Staging boundary

The existing EC2 target is designated staging. The future production environment is separate and must not reuse staging data, credentials or acceptance evidence. The hardened deployment topology is shared, but `ENVIRONMENT` identity is explicit and verified.

P24 automation being green in repository CI is not a live staging deployment. Staging evidence starts only when the protected workflow reaches the real host, the exact release is recorded, and the chained public HTTPS Launch Smoke passes for that same SHA.

## Source of truth

- `elitedom-store/backend/`
- `elitedom-store/frontend/`
- `elitedom-store/odoo/`
- `.github/workflows/real-e2e.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/deploy.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/scripts/build_rc_manifest.py`
- `docs/delivery/releases/`

## Verification

Use repository CI, Real Stack E2E/P23 UAT evidence and P24 deployment-contract checks for code qualification. Use protected staging deployment logs, public exact-SHA Launch Smoke, provider/human UAT, monitoring and recovery evidence for the actual environment. This page is not itself approval to open production traffic.

## Change policy

Update this document in the same pull request as any change that alters application capability, release qualification, deployment execution, environment commissioning or launch evidence boundaries.
