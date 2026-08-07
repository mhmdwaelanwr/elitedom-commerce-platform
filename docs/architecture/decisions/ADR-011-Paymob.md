---
title: "ADR-011 — Paymob as Primary Payment Provider"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-011 — Paymob as Primary Payment Provider

## Status

Accepted

## Context

The target market requires Paymob payment methods and hosted/unified checkout while minimizing direct handling of sensitive card data.

## Decision

Use Paymob as the primary payment adapter. Keep secret/public/HMAC credentials server-side as appropriate, validate callback authenticity, persist payment attempts/provider identifiers, and treat browser redirects as non-authoritative.

## Consequences

- Provider enablement fails closed when keys, method IDs or HTTPS callbacks are invalid.
- Card and wallet payment method IDs are explicit configuration.
- Legacy Stripe remains compatibility-only until intentionally retired in a separate migration plan.
- Live merchant sandbox/production acceptance is a launch gate, not a CI assumption.

## Implementation evidence

- `elitedom-store/backend/app/integrations/paymob/`
- `elitedom-store/backend/alembic/versions/20260807_0009_paymob_payment_records.py`
- `elitedom-store/backend/app/config.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
