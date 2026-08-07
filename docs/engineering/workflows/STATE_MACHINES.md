---
title: "State Machines"
status: current
owner: engineering
document_type: domain-rules
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "State Machines behavior, evidence, or source-of-truth changes."
---

# State Machines

## Purpose

Documents important stateful workflows and their ownership. Exact enum values/transitions are authoritative in code.

## Current state

Orders, payments/refunds, fulfillment and RMA are explicit state machines. External providers report events; domain transition code decides whether a transition is valid.

## Invariants and controls

- Never assign arbitrary status strings from provider/browser payloads.
- Reject impossible backward/duplicate transitions unless the domain explicitly defines idempotent no-op handling.
- Persist enough provider/event/audit identity to reconcile state.
- Tests should cover terminal states and invalid transitions.

## Source of truth

- `elitedom-store/backend/app/shared/schemas.py`
- `elitedom-store/backend/app/modules/payments/transitions.py`
- `elitedom-store/backend/app/modules/warranty/service.py`
- `elitedom-store/backend/app/modules/orders/`
- `elitedom-store/backend/app/modules/shipping/`

## Verification

Run transition/unit/integration tests and inspect provider duplicate-event behavior.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
