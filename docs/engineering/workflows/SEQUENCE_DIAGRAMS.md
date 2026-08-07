---
title: "Sequence Flows"
status: current
owner: engineering
document_type: domain-rules
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Sequence Flows behavior, evidence, or source-of-truth changes."
---

# Sequence Flows

## Purpose

Provides text-based sequence references for critical cross-boundary interactions.

## Current state

Sequences prioritize trust and transaction boundaries rather than visual notation. Provider/ERP calls are external and can fail/retry independently of local commits.

## Invariants and controls

- Identity: client → auth API → session persistence → optional provider delivery/identity verification.
- Checkout: client → order validation → payment attempt → Paymob → verified callback → payment/order transition.
- Odoo: domain event/outbox → connector/provider delivery → signed webhook → idempotent receipt → domain update.
- RMA: customer → ownership/eligibility validation → persisted ticket/outbox → staff permission review → valid transition.
- Launch: operator → release/environment → automatic gates + manual evidence → audit → external smoke.

## Source of truth

- `elitedom-store/backend/app/`
- `elitedom-store/odoo/addons/elitedom_connector/`
- `elitedom-store/frontend/src/app/`

## Verification

Use integration tests and traces/request IDs in staging to confirm ordering/error handling.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
