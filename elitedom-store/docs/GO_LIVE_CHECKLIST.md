---
title: "Go-Live Checklist"
status: operational
owner: operations
document_type: runbook-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Go-live gates, deployment topology, provider requirements, UAT matrix, recovery evidence, or launch-control behavior changes."
---

# Go-Live Checklist

## Purpose

Provides the compact operator gate list used immediately before production launch. The detailed procedure, failure semantics, and evidence guidance are in `GO_LIVE_RUNBOOK.md`.

## Release identity

- [ ] Exact immutable `release_ref` recorded.
- [ ] Target environment recorded as production.
- [ ] Release owner and rollback owner identified.
- [ ] Previous known-good application ref identified.

## Repository qualification

- [ ] Backend lint/tests green on the release candidate.
- [ ] Frontend lint/type/design/build checks green.
- [ ] PostgreSQL fresh upgrade and downgrade/replay checks green.
- [ ] Odoo 17 clean addon install/tests green.
- [ ] Development/production Docker Compose validation green.
- [ ] Launch acceptance asset validation green.
- [ ] Repository and documentation hygiene green.

## Production configuration

- [ ] `DEBUG=false`.
- [ ] Allowed hosts are explicit and contain no wildcard.
- [ ] CORS origins are explicit production HTTPS origins.
- [ ] `STAFF_MFA_REQUIRED=true`.
- [ ] `RATE_LIMIT_BACKEND=redis`.
- [ ] Core application/JWT/database/Redis secrets are generated, strong, and appropriately distinct.
- [ ] Metrics are disabled or protected with the required strong bearer token.
- [ ] Public storefront/API URLs are correct and HTTPS.
- [ ] Proxy/TLS/DNS configuration is verified for the target domains.

## Data and migrations

- [ ] Expected Alembic head confirmed for the deployed code.
- [ ] Application database backup created.
- [ ] Odoo database backup created.
- [ ] Restore drill completed in an isolated target and evidence captured.
- [ ] Migration/rollback compatibility reviewed for data that may be written after launch.
- [ ] No destructive cleanup/reset command is part of normal deployment.

## Runtime readiness

- [ ] Storefront reachable over public HTTPS.
- [ ] API `/health/live` succeeds.
- [ ] API `/health/ready` succeeds with dependencies ready.
- [ ] Celery worker/beat are healthy for configured workloads.
- [ ] Odoo integration endpoint is reachable and authenticated.
- [ ] No unexplained critical/error storm exists in logs.
- [ ] Metrics/tracing are functioning as configured without secret/PII leakage.

## Provider acceptance

- [ ] Paymob card/wallet methods configured for the intended launch path.
- [ ] Paymob payment initiation completed against the target merchant environment.
- [ ] Paymob verified callback processed correctly and duplicate callback remained idempotent.
- [ ] Paymob refund/reconciliation path accepted.
- [ ] Google Sign-In accepted in the target environment.
- [ ] Apple Sign-In accepted in the target environment.
- [ ] Twilio OTP send/verify/resend/abuse behavior accepted.
- [ ] Odoo catalogue/inventory/order/shipment round trip accepted.
- [ ] Optional providers are either tested when enabled or explicitly recorded as disabled.

## Customer and staff UAT

- [ ] English storefront critical journeys accepted.
- [ ] Arabic/RTL storefront critical journeys accepted.
- [ ] Light/dark/system themes accepted on critical screens.
- [ ] Mobile/tablet/desktop responsive smoke accepted.
- [ ] Keyboard/focus/accessibility smoke accepted.
- [ ] Authentication/session/account/address journeys accepted.
- [ ] Catalogue/search/product/cart journeys accepted.
- [ ] Checkout/payment success/failure/pending/retry behavior accepted.
- [ ] Order history/fulfillment/shipping accepted.
- [ ] Return/refund/warranty/RMA journeys accepted.
- [ ] Admin RBAC/MFA/audit/catalogue/payment/integration/launch-control journeys accepted for representative roles.

## External smoke and observability

- [ ] Public launch smoke executed using `.github/workflows/launch-smoke.yml` or equivalent `live_smoke.py` invocation.
- [ ] `robots.txt` and `sitemap.xml` verified.
- [ ] Defensive security headers verified by the smoke path.
- [ ] Logs available to the operating team.
- [ ] Metrics scrape verified through the protected boundary when enabled.
- [ ] Tracing export verified when enabled.
- [ ] Alert routing reaches the intended operator/on-call path.

## Rollback readiness

- [ ] Previous image/ref can be redeployed.
- [ ] Traffic/DNS/proxy reversal procedure is known.
- [ ] Database compatibility with the previous version is understood.
- [ ] Provider/webhook configuration reversal requirements are documented.
- [ ] Stop conditions for rollback vs forward-fix are agreed.
- [ ] Rollback drill/evidence recorded for the release.

## Launch-control approval

- [ ] Automatic launch blockers are clear for the target environment.
- [ ] Required manual gates are recorded for the exact release/environment.
- [ ] Every `passed` gate has a non-secret evidence reference.
- [ ] Every `waived` gate has explicit rationale and an accepted risk owner.
- [ ] Final sign-off is recorded before opening traffic.
- [ ] Post-cutover observation ownership remains active after traffic opens.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `.github/workflows/ci.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/scripts/live_smoke.py`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/backend/app/tests/integration/test_stage10_launch_acceptance.py`

## Verification

This checklist is complete only when its items are backed by the exact release candidate's CI and target-environment evidence. A checked box without evidence where the launch control requires evidence is not equivalent to a passed gate.

## Maintenance rule

Keep this checklist synchronized with `GO_LIVE_RUNBOOK.md` and the backend launch-control gate definitions. Add/remove checklist items in the same change that changes required release evidence.
