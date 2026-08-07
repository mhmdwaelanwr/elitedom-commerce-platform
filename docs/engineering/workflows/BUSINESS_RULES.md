---
title: "Business Rules"
status: current
owner: engineering
document_type: domain-rules
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Business Rules behavior, evidence, or source-of-truth changes."
---

# Business Rules

## Purpose

Summarizes cross-domain invariants that must remain server-authoritative.

## Current state

Detailed rules live in domain services/models/transitions. This document captures rules whose accidental duplication in frontend/providers would be dangerous.

## Invariants and controls

- Final price, discounts, tax/shipping inputs, stock and payable amount are calculated/validated server-side.
- Order/payment/refund/fulfillment/RMA state moves only through valid transitions.
- Provider callbacks and redirects cannot bypass ownership/authorization/domain validation.
- Duplicate external events must not repeat a business effect.
- RMA claims require owned eligible completed orders and serial validation where product tracking requires it.
- Staff actions require backend permission checks and MFA state where configured.
- Release approval evidence is scoped by immutable release reference and environment.

## Source of truth

- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/shared/`
- `elitedom-store/backend/app/integrations/`

## Verification

Review transition/service tests whenever a rule changes; frontend behavior alone is not acceptance.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
