---
title: "Operations Runbook Index"
status: current
owner: operations
document_type: runbook
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Operations Runbook Index behavior, evidence, or source-of-truth changes."
---

# Operations Runbook Index

## Purpose

Provides the starting point for routine and incident operations.

## Current state

Operational execution should begin with service health/readiness, deployment version and recent change context. Detailed go-live procedures live close to runtime in `elitedom-store/docs/GO_LIVE_RUNBOOK.md`.

## Invariants and controls

- Identify release/environment before making changes.
- Prefer reversible, minimal interventions and capture an audit/evidence reference.
- Do not run destructive cleanup (`make clean`, volume deletion, restore) without explicit scope/backup confirmation.
- Treat payment/order/inventory manual corrections as audited domain operations, not database ad-hoc edits.

## Source of truth

- `docs/operations/runbooks/`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `elitedom-store/infrastructure/`

## Verification

Use health/readiness, logs/metrics, database/provider evidence and post-action verification.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
