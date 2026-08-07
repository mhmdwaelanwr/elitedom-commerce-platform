---
title: "Paymob Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Paymob Integration behavior, evidence, or source-of-truth changes."
---

# Paymob Integration

## Purpose

Documents the Paymob boundary, implementation status, security controls and operational enablement requirements.

## Current state

Paymob is the primary target-market payment provider. FastAPI owns provider initiation, attempt persistence, callback verification, payment-state transitions and refund/reconciliation rules. Hosted/unified checkout keeps sensitive card entry outside the Elitedom application.

## Invariants and controls

- Enabling Paymob requires strong secret/public/HMAC values, positive card/wallet method IDs and HTTPS provider/callback URLs.
- Browser redirection is UX, not payment-authority.
- Callbacks are verified and processed idempotently.
- Payment totals originate from server-authoritative order/cart calculations.

## Enablement and failure mode

Production readiness requires merchant sandbox/live credentials, configured methods, public HTTPS notification/redirection URLs and successful end-to-end merchant acceptance for the exact release.

## Source of truth

- `elitedom-store/backend/app/integrations/paymob/`
- `elitedom-store/backend/app/modules/payments/`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/alembic/versions/20260807_0009_paymob_payment_records.py`

## Verification

Run relevant unit/integration tests and configuration validation. Production readiness requires merchant sandbox/live credentials, configured methods, public HTTPS notification/redirection URLs and successful end-to-end merchant acceptance for the exact release.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
