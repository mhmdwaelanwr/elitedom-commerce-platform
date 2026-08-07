---
title: "ADR-006 — Stripe Payment Provider"
status: superseded
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Superseded
superseded_by: ADR-011-Paymob.md
---

# ADR-006 — Stripe Payment Provider

## Status

Superseded

Superseded by: `ADR-011-Paymob.md`.

## Context

Stripe was the original card-payment decision and created schema/webhook compatibility that still exists in repository history and legacy code.

## Decision

Retain the historical decision and isolated compatibility implementation, but do not treat Stripe as the primary target payment provider.

## Consequences

- Legacy Stripe webhook/configuration paths must be clearly labeled.
- Existing migration history is never rewritten to erase Stripe.
- New target-market payment work follows the Paymob ADR.

## Implementation evidence

- `elitedom-store/backend/app/integrations/stripe/`
- `elitedom-store/backend/alembic/versions/20260806_0003_stripe_payment_events.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
