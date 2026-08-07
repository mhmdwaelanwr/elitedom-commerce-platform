# Stage 10 — Tests, UAT, Go-Live & Launch Acceptance

Stage 10 turns the merged Stage 0–9 platform into a release candidate with an explicit, auditable launch decision. It does **not** claim that third-party production credentials or merchant accounts have been accepted until an operator records evidence from the real provider environment.

## Goals

- preserve the five mandatory CI checks established in earlier stages;
- add a dedicated launch-acceptance CI gate;
- expose a safe Launch Control Plane to authorized staff;
- persist manual UAT and operational sign-off with evidence references;
- isolate every sign-off by immutable release reference and runtime environment;
- provide a public external smoke runner for staging/production;
- document deployment, backup/restore, provider acceptance, monitoring, and rollback;
- make the release decision fail closed while blockers remain.

## Launch Control Plane

The admin API exposes `GET /api/v1/admin/launch-readiness?release_ref=<sha-or-tag>` under `config.view` and `PATCH /api/v1/admin/launch-readiness/{gate_key}?release_ref=<sha-or-tag>` under `config.manage`.

The `release_ref` is mandatory and must identify the exact release candidate, preferably the immutable Git commit SHA planned for deployment. Operator evidence is keyed by `(release_ref, environment, gate)` so a successful UAT, backup drill, provider acceptance, or rollback drill from an older build cannot silently satisfy a newer release.

Automatic gates are derived from safe runtime facts only. They never return secret values. They cover release scoping, production mode, debug state, staff MFA, distributed rate limiting, metrics protection, allowed hosts, HTTPS CORS, required provider configuration, media/CDN readiness, and tracing export.

Operator gates are stored in `elitedom_launch_acceptance` and support `pending`, `passed`, `failed`, and `waived`. A passed gate requires an evidence reference. A waiver requires explanatory notes. Every write is recorded in the Stage 7 administrative audit trail with the release/environment scope.

Overall states:

- `blocked`: at least one required gate is pending, failed, or automatically unsafe;
- `conditional`: no blockers remain, but one or more warnings/waivers remain;
- `ready`: all required gates pass and no warnings remain.

The UI is available at `/admin/launch` and requires the operator to select the release reference before reading or writing launch evidence. It preserves EN/AR, RTL/LTR, responsive layouts, permission-aware read-only mode, loading, empty, and error states.

## UAT matrix

The following operator gates must be supported with evidence from the target staging/production environment for the exact release candidate being approved:

| Gate | Acceptance evidence |
| --- | --- |
| English storefront UAT | Recorded walkthrough covering search/catalog, product, cart, checkout, account, admin-visible order |
| Arabic + RTL storefront UAT | Same flow in Arabic with RTL, locale formatting, no clipped or reversed controls |
| Responsive + accessibility smoke | Mobile/tablet/desktop checks, keyboard navigation, visible focus, labels, contrast spot-check |
| Paymob live flow | Sandbox or approved merchant environment payment + signed webhook + refund result |
| Google Sign-In | Real configured client flow and callback |
| Apple Sign-In | Real configured client flow and callback |
| Twilio OTP | Real Egyptian phone delivery, verification, retry/rate-limit behavior |
| Odoo round trip | Product/order/stock integration round trip with signed webhook behavior |
| Fulfillment/refund | Reserve, fulfill, ship/deliver, return/refund path with idempotent retries |
| Backup/restore | Fresh PostgreSQL restore and application readiness verification |
| Monitoring/alerts | Metrics/logs/traces accessible to operators and alert delivery tested |
| Rollback drill | Previous release restored with database compatibility and health checks |

Evidence references may be GitHub run URLs, ticket IDs, runbook records, provider transaction references with sensitive values redacted, or internal test-report references. Do not paste secrets into the evidence or notes fields.

## External smoke

`.github/workflows/launch-smoke.yml` is a manually dispatched workflow that runs `elitedom-store/scripts/live_smoke.py` against explicit storefront and API origins.

The runner verifies:

1. storefront HTTP 200;
2. `robots.txt` is present and advertises a sitemap;
3. `sitemap.xml` is present;
4. `/health/live` reports healthy and carries expected security headers;
5. `/health/ready` reports PostgreSQL and Redis ready and carries expected security headers.

Remote workflow execution accepts public HTTPS origins only. The script resolves DNS immediately before each request and rejects private, loopback, link-local, multicast, reserved, or unspecified addresses. HTTP redirects are disabled so a validated public target cannot redirect the runner to an unvalidated destination. `--allow-local` exists only for an explicitly developer-operated local smoke test and is prohibited by repository launch-asset validation in the remote workflow.

The workflow saves `launch-smoke.json` as a 30-day artifact so its run URL/artifact can be referenced by a launch gate for the matching release candidate.

## Dedicated CI launch gate

The main CI keeps the existing five jobs and adds **Launch acceptance**. This job validates that the launch control-plane code, migration, UI, external smoke workflow, Stage 10 documentation, release scoping, redirect guard, and go-live runbook remain wired into the repository.

The backend job also executes `test_stage10_launch_acceptance.py` as part of the complete test suite. That coverage explicitly proves that passing a gate for Release A leaves the same gate pending for Release B. The migration job exercises `0014_launch_acceptance` through fresh upgrade, latest downgrade/replay, and full downgrade/replay.

## Known live-provider gates

Repository CI cannot truthfully prove merchant/provider acceptance for Paymob, Google, Apple, Twilio, a production Odoo instance, DNS/TLS, SMTP delivery, CDN behavior, or alert routing. These remain explicit operator gates and must not be marked passed until tested with the real target configuration for the exact release reference.

Production secrets stay deployment-managed. They are never committed, returned by the launch API, stored in launch notes, or embedded in smoke artifacts.

## Release decision

A merge of Stage 10 means the codebase contains the release-control mechanisms and automated tests. It is **not** equivalent to a live production launch. Actual go-live requires:

- production/staging environment variables and generated secrets;
- public HTTPS DNS/TLS endpoints;
- provider credentials and callbacks provisioned;
- the deployed candidate matching the release reference used for sign-off;
- successful external smoke run;
- required operator gates passed with evidence for that release;
- release owner sign-off according to `elitedom-store/docs/GO_LIVE_RUNBOOK.md`.
