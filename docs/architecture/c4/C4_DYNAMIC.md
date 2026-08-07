---
title: "C4 Dynamic Flows"
status: current
owner: architecture
document_type: c4
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Cross-component sequence ordering, trust boundaries, idempotency, or release-control behavior changes."
---

# C4 Dynamic Flows

## Purpose

Captures cross-component runtime sequences where ordering, trust, durability, or idempotency matters. Static C4 container/component views describe ownership; this page describes how critical transactions move between those boundaries.

## Current state

Critical dynamic flows are identity/session creation, checkout/payment, Paymob callbacks, Odoo inbound/outbound synchronization, notification tasks, refund transitions, RMA intake, and launch approval.

## Sequence invariants

- Provider callbacks are verified before domain mutation.
- Duplicate external delivery must not produce duplicate business effects.
- Database commit precedes asynchronous external delivery when transactional outbox semantics are used.
- Frontend redirect/callback UX is not authoritative evidence of payment success.
- Server-side authorization is evaluated at protected API boundaries rather than inferred from frontend state.
- Launch evidence is scoped by release reference and environment and cannot be reused implicitly across releases.

## Checkout and Paymob sequence

1. Customer submits checkout intent from the storefront.
2. FastAPI validates identity/session where required, cart contents, server-authoritative prices, discounts, shipping, stock rules, currency, and payable total.
3. Application state and a provider payment attempt are persisted.
4. The Paymob adapter initiates provider checkout using server-held configuration and the configured public notification/redirection URLs.
5. Browser navigation may reflect UX progress, but it does not authorize a paid state.
6. Paymob callback enters the dedicated webhook boundary, is authenticated using the provider verification contract, and is processed idempotently.
7. Payment/order state transitions occur only after verified server-side processing.
8. Repeated callbacks resolve to the existing receipt/attempt state rather than replaying business effects.

## Odoo synchronization sequence

1. A committed application event creates or advances outbox/delivery state where external ERP delivery is required.
2. Worker logic sends the contract to Odoo with the repository-defined authentication/signing behavior.
3. Retry state is persisted for transient failure rather than hiding delivery loss.
4. Odoo-originated product, inventory, order, or shipment events enter the dedicated webhook boundary.
5. Signature/HMAC verification and delivery-receipt/idempotency checks occur before applying the event.
6. The application maps ERP identifiers to its own domain records without using cross-database transactions.

## Authentication/session sequence

1. A password, phone OTP, or supported social flow establishes an authenticated identity through backend code.
2. Session/refresh state is persisted so revocation and device/session controls are not derived from a role claim alone.
3. Staff entering privileged administration is additionally gated by persisted role/permission state and staff MFA requirements.
4. Sensitive MFA enrollment/verification responses use defensive caching behavior.

## Release-acceptance sequence

1. Operator selects an immutable release reference.
2. Backend control-plane service evaluates automatic configuration/provider gates for the current environment.
3. Required manual gates are loaded only for the selected release/environment pair.
4. A `passed` manual gate requires an evidence reference; a waiver requires operator rationale.
5. Audit metadata records verifier/time and preserves previous release evidence separately.
6. Overall readiness remains blocked while required blockers exist.

## Failure semantics

- Invalid or unverifiable provider callbacks fail before trusted state transition.
- Outbox/provider transient failure remains retryable and observable rather than becoming an implicit success.
- Rate-limit/metrics/readiness failures use explicit HTTP failure behavior.
- Launch evidence missing for the current release remains pending/blocking even if another release passed the same gate.

## Source of truth

- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/shared/outbox.py`
- `elitedom-store/backend/app/modules/payments/`
- `elitedom-store/backend/app/modules/auth/`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/backend/app/tests/integration/test_stage10_launch_acceptance.py`

## Verification

Use payment/webhook/Odoo integration tests, authentication/session tests, migration tests, and Stage 10 release-scoping tests to verify sequence invariants. Provider/live execution remains environment-specific acceptance evidence.

## Change policy

Update this document in the same pull request as changes to callback trust, outbox ordering, payment authority, authentication/session boundaries, Odoo event sequencing, or launch-readiness evidence semantics.
