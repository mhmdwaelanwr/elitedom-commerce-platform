---
title: "Stage 10 — UAT, Go-Live and Launch Acceptance"
status: historical
owner: delivery
document_type: release-record
verified_against: "release-history"
review_trigger: "Historical release records are immutable except for factual corrections with an explicit audit note."
---

# Stage 10 — UAT, Go-Live and Launch Acceptance

## Record status

This document is a historical delivery record for Stage 10. It records what the stage added and the acceptance model that existed at completion. Current launch behavior belongs to living operations/architecture documentation and executable code.

## Objective

Convert production readiness from an informal checklist into an auditable, release-specific decision that distinguishes repository/CI evidence from target-environment UAT, provider, recovery, monitoring, and rollback evidence.

## Outcome

Stage 10 added a backend **Launch Control Plane**, staff admin launch UI, release-scoped persistence, external public smoke workflow, launch-asset validation, and an executable go-live/rollback runbook. The stage deliberately did **not** treat green CI as proof that a public production environment or merchant/provider account was live-ready.

## Launch Control Plane

The control plane introduced two evidence classes:

1. **Automatic gates** derived from runtime configuration and production safety invariants.
2. **Manual operator gates** whose state is stored with verifier, time, notes, and evidence reference.

Manual gate state supports `pending`, `passed`, `failed`, and `waived`. A passed gate requires an evidence reference. A waiver requires rationale and remains a risk decision rather than being semantically equivalent to a successful test.

The backend remains the authority for launch status; the admin UI only presents and records allowed operations through backend permissions.

## Release evidence isolation

A critical Stage 10 hardening change scoped launch evidence by **release reference + environment + gate**. This prevents a UAT/provider/recovery pass recorded for Release A from being inherited silently by Release B.

The persistence model and integration test explicitly prove that evidence does not carry between release references. This rule is fundamental to current release acceptance semantics.

## Automatic readiness gates

The stage evaluated production-readiness configuration such as:

- production/staging environment mode;
- debug disabled;
- staff MFA required;
- Redis-backed rate limiting;
- metrics protection when enabled;
- safe hosts/CORS;
- provider configuration requirements when a provider is enabled;
- production media/CDN/object-storage configuration;
- other fail-closed settings already implemented by configuration validation.

Automatic gates do not prove that an external account works; they prove that the repository/runtime configuration satisfies the machine-verifiable contract.

## UAT matrix

The Stage 10 manual acceptance design covered:

- English storefront critical journeys;
- Arabic/RTL storefront critical journeys;
- responsive and accessibility smoke;
- Paymob payment/callback/refund acceptance;
- Google Sign-In acceptance;
- Apple Sign-In acceptance;
- Twilio OTP acceptance;
- Odoo catalogue/inventory/order/shipment round trip;
- fulfillment, delivery, return and refund flows;
- PostgreSQL backup and restore drill;
- monitoring/alert-routing validation;
- rollback drill.

These gates are environment-specific and require operator/provider evidence for the exact release candidate.

## External smoke

Stage 10 added `.github/workflows/launch-smoke.yml` and `elitedom-store/scripts/live_smoke.py` for manual external verification of a deployed public environment.

The smoke path verifies public storefront/API behavior including storefront reachability, `robots.txt`, `sitemap.xml`, API liveness/readiness, and defensive security headers. It is hardened to reject unsafe/private/internal targets and fail closed on redirects so the CI runner cannot be repurposed as an internal-network fetcher.

Smoke execution emits machine-readable evidence/artifacts for the selected deployment without embedding production secrets in the repository.

## Known live-provider gates

At Stage 10 completion, several launch requirements necessarily remained outside repository CI and required real target-account/environment acceptance:

- Paymob merchant credentials, payment-method IDs, public HTTPS callback/redirection URLs, payment/callback/refund execution;
- Google OAuth production configuration and browser acceptance;
- Apple Sign-In production configuration and browser acceptance;
- Twilio production sender/messaging configuration and OTP delivery acceptance;
- Odoo target deployment credentials/connectivity and round-trip operational acceptance;
- DNS/TLS/public routing for storefront and API;
- backup storage and successful restore evidence;
- real monitoring/alert routing;
- environment-specific UAT and rollback evidence.

The stage recorded these as explicit launch gates rather than marking them delivered merely because provider adapters existed in code.

## Go-live and rollback runbook

The stage added/updated an executable runbook covering:

- pre-deployment release identity and ownership;
- migration graph review;
- application/Odoo backup and restore proof;
- deployment and runtime readiness;
- provider acceptance;
- EN/AR/RTL/responsive/accessibility UAT;
- public smoke execution;
- monitoring/alerting;
- rollback planning and stop conditions;
- final release sign-off.

Rollback planning explicitly distinguishes application rollback from destructive database downgrade/restore. Schema/data compatibility must be evaluated before choosing a recovery action.

## Security and authorization controls

Launch-control read/write operations reuse backend permission boundaries. Release evidence is audited; frontend visibility does not grant authority. The external smoke guard and provider/config fail-closed behavior preserve the project's existing security posture.

## Persistence and migration

Stage 10 added migration `0014_launch_acceptance` extending the Stage 9 MFA/session migration chain. The migration stores launch acceptance with release/environment scope and remains part of the repository's required fresh/latest/full migration replay tests.

## Verification evidence

Stage completion required:

- backend integration coverage for launch acceptance permissions/evidence/release isolation;
- migration 0014 fresh/latest/full replay;
- frontend lint/type/production build;
- Odoo clean install/module tests;
- Docker Compose development/production validation;
- Launch acceptance asset validation;
- final PR CI on the exact Stage 10 head;
- post-merge CI on `main`.

## Limitations at completion

Stage 10 completed the **software and process controls for launch acceptance**. It did not and could not create production merchant/OAuth/SMS/ERP accounts, issue production secrets, configure the final public infrastructure, or manufacture genuine UAT/recovery/provider evidence. Those remain release- and environment-specific operational responsibilities.

## Current references

For current behavior, use:

- `../../architecture/README.md`
- `../../operations/README.md`
- `../../../elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `../../../elitedom-store/docs/GO_LIVE_CHECKLIST.md`
- `../../../elitedom-store/docs/IMPLEMENTATION_STATUS.md`

## Historical maintenance rule

Do not rewrite this record to describe later implementation changes. Make only factual corrections to the Stage 10 record, and document subsequent changes in living documentation, a newer release record, or an ADR as appropriate.
