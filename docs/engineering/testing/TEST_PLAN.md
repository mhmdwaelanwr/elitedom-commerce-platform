---
title: "Test Plan"
status: current
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Test Plan behavior, evidence, or source-of-truth changes."
---

# Test Plan

## Purpose

Defines the layered verification strategy from unit tests through launch acceptance.

## Current state

CI runs backend tests/lint, frontend lint/types/build, PostgreSQL migration replay, Odoo clean install/native tests, Compose validation and launch-asset validation. Repository/documentation hygiene runs separately. Live provider/UAT/load/recovery checks remain environment-specific.

## Invariants and controls

- Unit tests cover pure domain/config/security helpers and deterministic edge cases.
- Integration tests cover database-backed auth, payment, fulfillment, admin, media and launch boundaries.
- Migration tests prove schema replay, not merely current-head upgrade.
- Odoo tests prove addon installability and native behavior.
- Frontend build/lint/types/design-system checks prove build-time integrity; browser UAT remains separate.
- External smoke/UAT/provider acceptance use immutable release references.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/repository-hygiene.yml`
- `elitedom-store/backend/app/tests/`
- `elitedom-store/frontend/package.json`

## Verification

All applicable automated jobs must be green; manual gates must attach environment/release evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
