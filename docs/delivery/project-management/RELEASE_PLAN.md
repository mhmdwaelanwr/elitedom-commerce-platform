---
title: "Release Plan"
status: current
owner: delivery
document_type: delivery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Release gates, launch evidence semantics, deployment/rollback process, or provider/UAT acceptance requirements change."
---

# Release Plan

## Purpose

Defines how a code-complete candidate becomes an approved environment release while keeping repository correctness, environment readiness, and launch authorization as separate evidence classes.

## Release lifecycle

1. **Candidate selection** — choose an immutable commit SHA/tag from a green `main` baseline and identify the target environment.
2. **Repository qualification** — require backend, frontend, PostgreSQL migration replay, Odoo, Docker Compose, launch-asset, repository-hygiene, and documentation-quality gates as applicable.
3. **Deployment preparation** — validate production configuration, secrets delivery, DNS/TLS, image/build inputs, migration graph, backup/restore plan, monitoring, and rollback ownership.
4. **Environment deployment** — deploy the exact candidate, apply migrations with the matching code, and verify runtime dependency readiness.
5. **External acceptance** — run public HTTPS smoke plus provider, EN/AR/RTL, responsive/accessibility, commerce, fulfillment/refund, Odoo, backup/restore, monitoring, and rollback evidence.
6. **Release sign-off** — record required manual evidence for the exact release/environment in the launch control plane and resolve blockers/waivers explicitly.
7. **Traffic opening and observation** — open traffic only after sign-off and keep rollback ownership active during the stabilization window.

## Evidence model

Automated CI proves properties of the repository/release candidate. It does not prove merchant credentials, public DNS/TLS, provider-account behavior, real alert routing, or successful recovery drills in a target environment. Manual launch gates store those environment-specific results by `release_ref`, environment, gate, verifier, timestamp, evidence reference, and notes.

Evidence from one release must not be reused implicitly for another release. Reuse is acceptable only when the gate definition explicitly permits external evidence to remain valid and the operator records a new decision for the new release.

## Release blockers

Examples include failed required CI, unresolved migration failure, dependency readiness failure, unsafe production configuration, missing required MFA/rate-limit/security configuration, failed Paymob/OAuth/OTP/Odoo acceptance, missing backup/restore proof, failed critical UAT, or an unowned rollback plan.

A waiver is a documented risk decision and is not semantically equivalent to a pass.

## Rollback planning

Every candidate must identify the previous known-good application ref and database compatibility assumptions before deployment. If migrations or new writes make the previous version incompatible, rollback may require a forward fix or controlled recovery rather than an automatic schema downgrade.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `.github/workflows/ci.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/scripts/validate_launch_assets.py`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/backend/app/tests/integration/test_stage10_launch_acceptance.py`

## Verification

Use the launch control plane, deployment/runbook evidence, CI runs on the exact candidate, and the target environment's external smoke/provider/recovery/UAT evidence. Release notes should reference evidence identifiers without copying secrets or customer data into Git.

## Change policy

Update this document with any change to required release gates, launch-evidence persistence, deployment sequencing, rollback expectations, or production acceptance responsibilities.
