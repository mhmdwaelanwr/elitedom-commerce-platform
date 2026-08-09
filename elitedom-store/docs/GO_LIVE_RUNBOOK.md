---
title: "Go-Live Runbook"
status: operational
owner: operations
document_type: implementation-reference
verified_against: "P16 protected deployment execution"
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
9. Confirm the target GitHub Environment contains the approved `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PRIVATE_KEY`, pinned `DEPLOY_KNOWN_HOSTS`, `DEPLOY_PATH`, `SITE_URL`, and `API_URL` values. Production approval rules belong on the GitHub Environment and are not bypassed by the workflow.
10. For an environment already deployed through P16, confirm the requested release is a forward promotion from the last successful deployed SHA. If an older release is required, stop the normal deployment path and use the rollback section instead.

## Database backup and restore

Before a migration or cutover that can change durable state:

1. create backups for the FastAPI application database and Odoo database using the repository backup procedure or an equivalent platform-native backup;
2. store backups outside the live database host/volume according to the target environment's retention policy;
3. restore into an isolated target and prove that the resulting databases are usable;
4. capture non-secret evidence including backup identifier, restore target, timestamps, operator, verification result, and recovery notes;
5. never assume that successful backup creation proves recoverability without a restore exercise.

The P16 remote deployer creates pre-migration application/Odoo dumps for any pre-existing databases and validates their gzip streams before Alembic or Odoo upgrade. These deployment-time backups do not replace the periodic restore drill required for launch acceptance.

## Deployment and migration

The implemented single-VPS execution entry point is `.github/workflows/deploy.yml`. Dispatch it with the protected target Environment and a full 40-character `release_ref` reachable from `main`. The workflow pins SSH host identity and invokes `elitedom-store/infrastructure/scripts/deploy_release.sh` on the configured VPS.

The normal deployment path is forward-only after the first successful P16 bootstrap. The remote deployer records the last successful release in the sibling host path `.elitedom-deployment-state/release_ref`, validates that value as a full Git SHA, and requires that it be an ancestor of the newly requested release. The state file is advanced only after runtime health and the Odoo smoke succeed; a failed deployment cannot silently become the new baseline.

The guarded remote sequence is:

1. reject a shallow deployment clone, unexpected Git origin, tracked local modifications, unsafe `.env` permissions, invalid target origins, invalid persisted release state, or a release that is not reachable from `origin/main`;
2. when a last-successful release exists, reject a requested commit that moves backward or onto an incompatible Git line;
3. check out exactly the requested commit without deleting untracked production configuration;
4. validate the production Compose topology;
5. wait for PostgreSQL/application DB initialization and take validated application/Odoo pre-migration backups;
6. build the release containers;
7. run `alembic upgrade head` against the application database;
8. upgrade the bundled Odoo connector;
9. start the target Compose topology with bounded health waiting;
10. run the repository Odoo integration smoke, verify the exact checked-out release, and atomically record it as the last successful deployment;
11. only after remote deployment succeeds, call the reusable Launch Smoke for the same public URLs and exact `release_ref`.

A remote failure stops execution for operator assessment. The deployer deliberately does not run database downgrade, automatic restore, destructive `git reset --hard`, or `git clean`.

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

Run `.github/workflows/launch-smoke.yml` against the public HTTPS storefront and API. It remains manually dispatchable for independent verification and is also reusable by the deployment workflow. Supply `site_url`, `api_url`, and the exact hexadecimal Git `release_ref` expected to be deployed. The smoke runner intentionally rejects unsafe/private targets and redirects to reduce SSRF-style misuse of CI runners.

Before browser UAT, `elitedom-store/scripts/verify_release.py` verifies release provenance by reusing the hardened public-target checks and comparing `/health/live.version` with the requested `release_ref`. Production Compose maps `RELEASE_REF` into FastAPI `APP_VERSION`, so a healthy but stale or wrong deployment fails before it can be signed off.

The workflow then runs the deployed browser E2E gate in Chromium. It paginates the complete public `/api/v1/catalog/products` response and does not mock or fulfill application API routes. Before choosing the product used for the commerce journey, the gate requires every public product to have a non-empty identity, positive backend-authoritative price, category, and real product media. Public placeholder/template product media is a launch blocker, and the selected PDP primary image must complete loading with real pixel dimensions.

The browser gate proves:

- the deployed frontend is wired to the API origin supplied for the release;
- the public catalogue pagination reaches the backend `total_count` rather than validating only the first page;
- every public product has launch-ready identity, price, category, and real product media;
- 390px Arabic/RTL PDP rendering reaches the localized backend-authoritative product, price and media state;
- the PDP primary image loads successfully rather than silently falling back to placeholder/template media;
- a guest can add that real product to the server-backed cart;
- the same guest cart reaches the Arabic checkout review with the real product summary and all supported customer-facing payment choices rendered;
- the order-submit control is visible, while the gate explicitly fails if checkout or payment mutation endpoints are called before operator-controlled provider UAT;
- the test returns to the cart and removes its guest-cart item afterward;
- Home, Catalog and PDP stay free of horizontal overflow at 430px and 1024px reference widths;
- the document `lang` and semantic `dir` values follow EN/LTR and AR/RTL state;
- unhandled browser exceptions fail the gate.

The deployed browser E2E deliberately stops before checkout submission, payment, order creation, provider callbacks or any other financially meaningful side effect. It tracks the checkout and payment mutation boundaries during the checkout review and requires zero such mutations. Those flows remain explicit provider/UAT gates with controlled test data.

Expected smoke evidence includes storefront reachability, `robots.txt`, `sitemap.xml`, API liveness/readiness, defensive security headers, expected/deployed release-ref evidence, complete-public-catalog browser assertions, the Playwright HTML/JSON report, and trace/screenshot/video artifacts retained on browser failure.

## Monitoring and alerting

Confirm the release can be observed before opening traffic:

- logs are available and correlated with request IDs where applicable;
- metrics scrape succeeds through the protected metrics boundary;
- configured tracing export is healthy when enabled;
- alert routing reaches the intended operator/on-call path;
- an operator can identify payment/provider/worker/database readiness failures from available signals.

## Rollback

Rollback must be designed before launch, not improvised after failure. The normal P16 deployment workflow is deliberately not a rollback mechanism: once `.elitedom-deployment-state/release_ref` exists, it refuses to deploy a commit older than the recorded last-successful release.

Record:

- previous known-good application image/ref;
- database compatibility between new and previous application versions;
- whether the latest migration has a safe downgrade path for the actual data already written;
- Odoo addon compatibility with the intended application rollback;
- provider/webhook/DNS configuration that must be reverted;
- traffic reversal procedure;
- owner and stop conditions.

Do not edit `.elitedom-deployment-state/release_ref` backward to bypass the guard. Preserve it as evidence of the last successfully verified release. Do not execute destructive database downgrade/restore solely because application rollback is required. If a new release has written data incompatible with the previous schema or behavior, use the incident/recovery plan appropriate to that state. The P16 deployer intentionally creates pre-migration backups but does not decide or execute a destructive rollback automatically.

## Release sign-off

A release is eligible to open traffic only when required automatic gates are passing and required operator gates contain valid evidence for the exact `release_ref` and environment. A waiver must contain rationale and should be treated as an explicit risk decision, not as equivalent to a successful test.

For a workflow-driven deployment, both the remote deployment job and the chained Launch Smoke must pass for the same release before deployment execution is considered successful evidence.

After cutover, observe key health, error, payment, provider, worker, and database signals closely and keep rollback ownership active until the release is considered stable by the operating team.

## Evidence handling

Launch evidence references should identify the external proof without copying secrets or customer data into the repository. Examples include an approved test-run identifier, deployment/backup artifact identifier, provider sandbox/live transaction reference, or internal incident/change record identifier. `deployment.log` is retained separately from browser/provenance launch evidence.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deployment-contract.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
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

Repository CI proves code/tests/migration/container/launch/deployment-asset contracts. The protected deployment workflow proves controlled release execution once real Environment credentials/variables are configured. The launch control plane and external smoke/UAT/provider/recovery evidence prove environment-specific readiness. None substitutes for the others.

## Change policy

Update this runbook in the same pull request that changes launch gates, deployment topology/execution, backup/restore procedure, provider acceptance, public smoke behavior, release-state behavior, or rollback requirements. Preserve previous release evidence as historical audit information rather than rewriting it to match a new release.
