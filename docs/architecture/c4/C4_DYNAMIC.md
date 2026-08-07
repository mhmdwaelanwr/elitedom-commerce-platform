---
title: "C4 Dynamic Flows"
status: current
owner: architecture
document_type: c4
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "C4 Dynamic Flows behavior, evidence, or source-of-truth changes."
---

# C4 Dynamic Flows

## Purpose

Captures cross-component runtime sequences where ordering, trust or idempotency matters.

## Current state

Critical dynamic flows are identity/session creation, checkout/payment, Paymob callbacks, Odoo inbound/outbound synchronization, notification tasks, refund transitions, RMA intake and launch approval.

## Invariants and controls

- Provider callbacks are verified before domain mutation.
- Duplicate external delivery must not produce duplicate business effects.
- Database commit precedes asynchronous external delivery when using outbox semantics.
- Frontend redirect/callback UX is not authoritative evidence of payment success.
- Launch manual evidence is scoped by release reference and environment.

## Representative payment sequence

1. Customer submits checkout intent.
2. Backend validates cart/order totals and creates provider attempt.
3. Paymob checkout is initiated with server-held credentials and configured callback URLs.
4. Browser may redirect, but trusted payment state changes only through verified backend/provider processing.
5. Duplicate callbacks are recognized and do not repeat side effects.
6. Refund/reconciliation paths apply explicit state transitions and audit data.

## Source of truth

- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/shared/outbox.py`
- `elitedom-store/backend/app/modules/payments/`
- `elitedom-store/backend/app/modules/admin/launch_service.py`

## Verification

Use integration tests and Stage 10 release-scoping tests to verify sequence invariants.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
