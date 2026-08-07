---
title: "PCI DSS Scope Guidance"
status: current
owner: operations
document_type: compliance-readiness
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "PCI DSS Scope Guidance behavior, evidence, or source-of-truth changes."
---

# PCI DSS Scope Guidance

## Purpose

Documents engineering choices intended to reduce payment-card data exposure; it is not a PCI attestation.

## Current state

Paymob hosted/unified checkout is intended to keep raw card entry outside Elitedom. The application stores order/payment/provider identifiers and state, not raw PAN/CVV. Legacy Stripe code remains but is not the primary payment architecture.

## Invariants and controls

- Never log/store raw card number, CVV or full sensitive authentication data.
- Keep provider secret/HMAC keys server-side.
- Use public HTTPS provider callback/redirect URLs.
- Document any future change that embeds/collects card data because it can materially change PCI scope.
- SAQ type/scope must be confirmed with the merchant/acquirer/QSA/provider; do not infer certification from architecture alone.

## Source of truth

- `docs/architecture/integrations/PAYMOB.md`
- `elitedom-store/backend/app/integrations/paymob/`
- `elitedom-store/backend/app/modules/payments/`

## Verification

Review real Paymob checkout integration and merchant PCI responsibilities before production.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
