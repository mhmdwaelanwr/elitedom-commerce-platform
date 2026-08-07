---
title: "Go-Live Runbook"
status: current
owner: operations
document_type: implementation-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Go-Live Runbook behavior, evidence, or source-of-truth changes."
---

# Go-Live Runbook

## Purpose

Defines the release procedure from approved code candidate to controlled public launch.

## Current state

Launch is authorized only for an immutable release reference and target environment. Automatic configuration gates and evidence-backed operator gates must be evaluated for that pair.

## Invariants and controls

- Freeze/select release reference and confirm required CI/hygiene checks.
- Validate production configuration without revealing secret values.
- Create and verify backup/restore evidence before risky migration/cutover.
- Deploy/migrate, then verify liveness/readiness and worker/Odoo health.
- Run external launch smoke against public HTTPS storefront/API.
- Execute EN/AR, RTL/LTR, responsive/accessibility, auth/MFA, catalogue/cart/checkout, Paymob, refund, fulfillment, Odoo and RMA UAT.
- Verify monitoring/alerts and rollback procedure.
- Record provider/UAT/recovery/monitoring evidence in launch control for the exact release/environment.
- Open traffic only after final release sign-off; observe closely after cutover.

## Pre-deployment

Confirm release SHA, environment, DNS/TLS plan, migration graph, backup, secrets/config and rollback owner.

## Database backup and restore

Prove application and Odoo backup restore in a controlled target; record recovery evidence.

## Provider acceptance

Exercise Paymob and every enabled live provider with target credentials/accounts. Disabled optional providers are documented as disabled, not silently assumed.

## Smoke test

Run the manual GitHub launch-smoke workflow or equivalent `live_smoke.py` against public HTTPS targets only.

## Rollback

Define application image/ref, database compatibility and provider/DNS reversal. Never improvise destructive rollback after migration without understanding downgrade/data impact.

## Release sign-off

Record manual gates with evidence reference, verifier and timestamp. Evidence is scoped by release and environment.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/scripts/live_smoke.py`
- `elitedom-store/backend/app/modules/admin/launch_service.py`

## Verification

Successful run produces auditable non-secret evidence references; failures keep the release blocked or explicitly waived with rationale.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
