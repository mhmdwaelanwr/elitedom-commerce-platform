---
title: "Release Plan"
status: current
owner: delivery
document_type: delivery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Release Plan behavior, evidence, or source-of-truth changes."
---

# Release Plan

## Purpose

Defines how a code-complete candidate becomes an approved environment release.

## Current state

A release candidate starts from a green immutable SHA. Automated gates prove repository integrity; manual gates prove environment/provider/UAT/recovery readiness. Stage 10 launch acceptance stores manual evidence by release reference and environment.

## Invariants and controls

- Select immutable SHA/tag and target environment.
- Require CI and repository/documentation hygiene green.
- Apply deployment/migration/backup plan and verify readiness.
- Run external public-HTTPS smoke.
- Complete provider, EN/AR, accessibility/responsive, backup/restore, monitoring and rollback acceptance.
- Record final sign-off; never reuse evidence from another release reference.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/backend/app/modules/admin/launch_service.py`

## Verification

Use the launch control plane and runbook; attach non-secret evidence references.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
