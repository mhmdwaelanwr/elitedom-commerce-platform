---
title: "ADR-013 — Release-Scoped Launch Acceptance"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-013 — Release-Scoped Launch Acceptance

## Status

Accepted

## Context

CI cannot prove live provider credentials, UAT, restore drills, monitoring or rollback readiness. Manual evidence must also not carry silently from one build to another.

## Decision

Use a launch control plane whose evidence is scoped by `release_ref + environment + gate`. Automatic configuration gates and operator sign-offs jointly determine readiness.

## Consequences

- Old UAT/provider evidence cannot approve a new release reference.
- Passed gates require evidence; waived gates require rationale.
- Launch readiness is auditable and environment-specific.

## Implementation evidence

- `elitedom-store/backend/app/modules/admin/launch_service.py`
- `elitedom-store/backend/alembic/versions/20260807_0014_launch_acceptance.py`
- `elitedom-store/frontend/src/app/admin/launch/page.tsx`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
