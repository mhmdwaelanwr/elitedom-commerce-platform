---
title: "Webhook Contracts"
status: current
owner: architecture
document_type: api
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Webhook Contracts behavior, evidence, or source-of-truth changes."
---

# Webhook Contracts

## Purpose

Defines inbound/outbound webhook rules for Paymob, Odoo and legacy Stripe compatibility.

## Current state

Paymob and Odoo are current integration boundaries. Legacy Stripe webhook handling remains present for compatibility/history. Odoo connector also emits signed events toward FastAPI. Webhook processing is designed to authenticate the event, normalize it, persist receipt/idempotency state and apply safe domain transitions.

## Invariants and controls

- Reject unverifiable signatures/HMAC before trusted mutation.
- Persist/use unique provider event identifiers or deterministic receipt keys.
- Return retry-compatible responses without repeating successful business effects.
- Do not trust browser redirect query parameters as payment truth.
- Keep raw sensitive payload logging minimized/masked.
- Provider-specific parsing belongs in integration adapters; domain services decide valid transitions.

## Source of truth

- `elitedom-store/backend/app/integrations/paymob/webhooks.py`
- `elitedom-store/backend/app/integrations/odoo/`
- `elitedom-store/backend/app/integrations/stripe/webhooks.py`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Verification

Run integration tests with valid, invalid and duplicate webhook samples; live provider acceptance is a separate launch gate.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
