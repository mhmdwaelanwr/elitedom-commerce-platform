---
title: "Go-Live Runbook"
status: operational
owner: operations
document_type: implementation-reference
verified_against: "8b3822d51b3d45ccf6250b46fc0b4780014dd6b7"
review_trigger: "Release controls, deployment topology, provider acceptance, rollback, or launch evidence requirements change."
---

# Go-Live Runbook

## Purpose

Defines the controlled path from an approved release candidate to public production launch. It separates what CI can prove from what operators and external providers must prove for a specific release and environment.

## Entry criteria

Before starting this runbook, the release candidate must have an immutable `release_ref`, a known target environment, a green repository baseline, and an identified release owner. Do not reuse launch evidence from a different release reference or environment.

## Launch control model

The admin launch-control plane combines automatic configuration gates with evidence-backed operator gates. Automatic gates inspect runtime configuration. Operator gates record `pending`, `passed`, `failed`, or `waived` state with verifier, timestamp, notes, and evidence reference. Required blocking gates must not be bypassed by treating a warning as a pass.

The current manual gate set covers:

- English storefront UAT;
- Arabic/RTL storefront UAT;
- responsive/accessibility smoke;
- Paymob payment/webhook/refund acceptance;
- Google Sign-In acceptance;
- Apple Sign-In acceptance;
- Twilio OTP acceptance;
- Odoo order/stock round-trip acceptance;
- fulfillment, delivery, return, and refund UAT;
- PostgreSQL backup/restore drill;
- monitoring/alert routing verification;
- rollback drill.

## Pre-deployment

1. Record the exact commit/tag used as `release_ref` and the target environment.
2. Set production `RELEASE_REF` to the exact hexadecimal Git commit SHA being deployed; production Compose maps it into FastAPI `APP_VERSION` for public release provenance.
3. Confirm required branch/PR checks are green on that exact code.
4. Review the migration graph and identify the current Alembic head.
5. Confirm production `DEBUG=false`, scoped hosts/CORS, staff MFA, Redis-backed rate limiting, protected metrics, and strong distinct application/database/Redis/provider secrets.
6. Confirm public site/API URLs, DNS and TLS termination plan.
7. Confirm production image references/build inputs are immutable or otherwise reproducible.
8. Confirm rollback owner, communication owner, and provider contacts/merchant access.

## Database backup and restore

Before a migration or cutover that can change durable state:

1. create backups for the FastAPI application database and Odoo database using the repository backup procedure or an equivalent platform-native backup;
2. store backups outside the live database host/volume according to the target environment's retention policy;
3. restore into an isolated target and prove that the resulting databases are usable;
4. capture non-secret evidence including backup identifier, restore target, timestamps, operator, verification result, and recovery notes;
5. never assume that successful backup creation proves recoverability without a restore exercise.

## Deployment and migration

1. Deploy the selected application images/configuration without exposing secret values in logs.
2. Run Alembic upgrade against the application database using the exact deployed code.
3. Verify Odoo addon compatibility/install state for the deployed connector version.
4. Start/verify FastAPI, React/Vite frontend, Redis, Celery worker/beat, PostgreSQL services, and Odoo according to the target topology.
5. Treat migration failure, unexpected schema head, or dependency-readiness failure as a launch blocker.

## Runtime readiness

Verify at minimum:

- storefront returns expected content over public HTTPS;
- API `/health/live` reports process liveness and exposes the deployed release SHA as `version` in production;
- API `/health/ready` reports dependency readiness and does not return 503;
- Celery workers are consuming the configured broker;
- Odoo is reachable through the configured integration boundary;
- no new critical/error storm is visible in logs or monitoring;
- metrics/tracing configuration is operating as intended without leaking secrets or PII.

## Provider acceptance

Exercise every provider enabled for the target production path using the target provider account and credentials. Disabled optional providers must be recorded as disabled rather than silently assumed healthy.

For the primary launch path, acceptance must include:

- Paymob card/wallet flow as configured, verified callback processing, idempotency, reconciliation state, and refund path;
- Google browser sign-in and account-link/profile-completion behavior;
- Apple browser sign-in and account-link/profile-completion behavior;
- Twilio phone OTP send/verify/resend and abuse-limit behavior;
- Odoo product/inventory/order/shipment round trip and signed webhook behavior.

Provider dashboards may be referenced by an evidence identifier, but credentials, tokens, customer PII, and private dashboard URLs must not be committed to Git.

## Storefront and administration UAT

Validate both English and Arabic experiences, including LTR/RTL direction, light/dark/system themes, locale-aware EGP display, responsive layouts, loading/empty/error states, keyboard/focus behavior, and critical customer/admin journeys.

Critical commerce UAT includes catalogue/search/product details, account/session behavior, cart merging, checkout, Paymob outcome handling, order history/status, fulfillment/shipping, refund/return flow, warranty/RMA, and permission boundaries in the admin console.

## External smoke test

Run `.github/workflows/launch-smoke.yml` against the public HTTPS storefront and API. Supply `site_url`, `api_url`, and the exact hexadecimal Git `release_ref` expected to be deployed. The workflow first invokes `elitedom-store/scripts/live_smoke.py`; the smoke runner intentionally rejects unsafe/private targets and redirects to reduce SSRF-style misuse of CI runners.

Before browser UAT, `elitedom-store/scripts/verify_release.py` verifies release provenance by reusing the hardened public-target checks and comparing `/health/live.version` with the requested `release_ref`. Production Compose maps `RELEASE_REF` into FastAPI `APP_VERSION`, so a healthy but stale or wrong deployment fails before it can be signed off.

The same manually dispatched workflow then runs the deployed browser E2E gate in Chromium. It discovers a purchasable Product ID from the real `/api/v1/catalog/products` response and does not mock or fulfill application API routes. The browser gate proves:

- the deployed frontend is wired to the API origin supplied for the release;
- 390px Arabic/RTL PDP rendering reaches the backend-authoritative product and price state;
- a guest can add that real product to the server-backed cart;
- the same guest cart reaches the Arabic checkout review with the real product summary and all supported customer-facing payment choices rendered;
- the order-submit control is visible, while the gate explicitly fails if checkout or payment mutation endpoints are called before operator-controlled provider UAT;
- the test returns to the cart and removes its guest-cart item afterward;
- Home, Catalog and PDP stay free of horizontal overflow at 430px and 1024px reference widths;
- the document `lang` and semantic `dir` values follow EN/LTR and AR/RTL state;
- unhandled browser exceptions fail the gate.

The deployed browser E2E deliberately stops before checkout submission, payment, order creation, provider callbacks or any other financially meaningful side effect. It tracks the checkout and payment mutation boundaries during the checkout review and requires zero such mutations. Those flows remain explicit provider/UAT gates with controlled test data.

Expected smoke evidence includes storefront reachability, `robots.txt`, `sitemap.xml`, API liveness/readiness, defensive security headers, expected/deployed release-ref evidence, the Playwright HTML/JSON report, and trace/screenshot/video artifacts retained on browser failure.

## Monitoring and alerting

Confirm the release can be observed before opening traffic:

- logs are available and correlated with request IDs where applicable;
- metrics scrape succeeds through the protected metrics boundary;
- configured tracing export is healthy when enabled;
- alert routing reaches the intended operator/on-call path;
- an operator can identify payment/provider/worker/database readiness failures from available signals.

## Rollback

Rollback must be designed before launch, not improvised after failure.

Record:

- previous known-good application image/ref;
- database compatibility between new and previous application versions;
- whether the latest migration has a safe downgrade path for the actual data already written;
- provider/webhook/DNS configuration that must be reverted;
- traffic reversal procedure;
- owner and stop conditions.

Do not execute destructive database downgrade/restore solely because application rollback is required. If a new release has written data incompatible with the previous schema or behavior, use the incident/recovery plan appropriate to that state.

## Release sign-off

A release is eligible to open traffic only when required automatic gates are passing and required operator gates contain valid evidence for the exact `release_ref` and environment. A waiver must contain rationale and should be treated as an explicit risk decision, not as equivalent to a successful test.

After cutover, observe key health, error, payment, provider, worker, and database signals closely and keep rollback ownership active until the release is considered stable by the operating team.

## Evidence handling

Launch evidence references should identify the external proof without copying secrets or customer data into the repository. Examples include an approved test-run identifier, backup/restore job identifier, provider sandbox/live transaction reference, or internal incident/change record identifier.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/scripts/live_smoke.py`
- `elitedom-store/scripts/verify_release.py`
- `elitedom-store/scripts/validate_launch_assets.py`
- `elitedom-store/frontend/playwright.launch.config.mjs`
- `elitedom-store/frontend/e2e/launch.spec.mjs`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/backend/app/modules/admin/control_schemas.py`
- `elitedom-store/backend/app/modules/admin/models.py`
- `elitedom-store/backend/alembic/versions/20260807_0014_launch_acceptance.py`
- `elitedom-store/backend/app/tests/integration/test_stage10_launch_acceptance.py`
- `elitedom-store/frontend/src/pages/admin/LaunchControlPage.tsx`

## Verification

Repository CI proves code/tests/migration/container/launch-asset contracts. The launch control plane and external smoke/UAT/provider/recovery evidence prove environment-specific readiness. Neither class of evidence substitutes for the other.

## Change policy

Update this runbook in the same pull request that changes launch gates, deployment topology, backup/restore procedure, provider acceptance, public smoke behavior, or rollback requirements. Preserve previous release evidence as historical audit information rather than rewriting it to match a new release.
