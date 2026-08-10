---
title: "P23 Release Candidate Gate"
status: current
owner: operations
document_type: release-reference
verified_against: "P23 production-like UAT release-candidate gate"
review_trigger: "P23 UAT scope, release-candidate evidence, staging promotion boundary, or launch prerequisites change."
---

# P23 — Production-like UAT & Release Candidate Gate

## What P23 proves

P23 extends the P22 real-stack browser gate into release-candidate qualification. The workflow starts an isolated stack containing React/Vite, FastAPI, PostgreSQL, Redis, Celery worker/beat and Odoo 17 with the bundled connector, then verifies that the running API reports the exact candidate Git SHA before browser UAT can qualify the candidate.

The automated UAT covers:

- 360x800 Arabic dark storefront rendering;
- 390x844 Arabic light storefront rendering;
- 430x932 English dark storefront rendering;
- 1024x768 English light/tablet rendering;
- Home, Catalog, Product Detail and Business public surfaces;
- AR/EN and semantic RTL/LTR;
- light/dark persistence across a real browser reload;
- horizontal-overflow rejection;
- browser exception and HTTP 5xx rejection;
- authenticated customer account at mobile size;
- verified B2B RFQ workspace at mobile size;
- system-admin MFA + RBAC + protected inventory surface at tablet size.

P22 functional journeys run first against the same isolated stack. Those journeys include a real customer order path using COD only, a real B2B RFQ path, and a real staff MFA/RBAC/admin path without application API mocking or authentication bypass.

## Release-candidate manifest

`elitedom-store/scripts/build_rc_manifest.py` emits `rc-manifest.json` only when:

- candidate SHA is a full 40-character Git SHA;
- `/health/live` is healthy and reports the exact candidate SHA;
- `/health/ready` is ready and every reported dependency is ready;
- the P22 Playwright report contains passing expected tests, no unexpected failures and no flaky tests;
- the P23 UAT Playwright report contains passing expected tests, no unexpected failures and no flaky tests.

The manifest explicitly marks the qualification environment as `isolated-ci-full-stack` and does not claim a live staging or production deployment.

## Promotion boundary

A P23-qualified candidate is eligible for **staging deployment and human/provider UAT continuation**. It is not production approval.

The remaining environment-specific launch work is:

1. provision a real VPS and configure the protected GitHub `staging` Environment;
2. configure public DNS/TLS and final site/API origins;
3. inject production-grade secrets and live/sandbox provider credentials outside Git;
4. deploy the exact qualified SHA through the protected forward-only deployment workflow;
5. run the public HTTPS Launch Smoke against the deployed SHA;
6. complete real Paymob, Google, Apple, Twilio/email and Odoo provider acceptance for that environment;
7. complete staging human UX/accessibility checks with real environment data and provider boundaries;
8. prove monitoring/alert routing and log visibility;
9. execute and retain database restore and rollback-drill evidence;
10. promote to production only after all required launch-control gates hold evidence for the same immutable release and environment.

## Evidence

The `Real Stack E2E` workflow preserves separate P22 and P23 artifacts. P23 evidence includes the UAT Playwright report/screenshots, readiness/liveness evidence, isolated UAT seed evidence and the qualified `rc-manifest.json`.

## Source of truth

- `.github/workflows/real-e2e.yml`
- `elitedom-store/frontend/playwright.integration.config.mjs`
- `elitedom-store/frontend/e2e/integration.spec.mjs`
- `elitedom-store/frontend/playwright.uat.config.mjs`
- `elitedom-store/frontend/e2e/uat.spec.mjs`
- `elitedom-store/scripts/build_rc_manifest.py`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
