---
title: "ADR-008 — Twilio SMS Delivery"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted as optional
---

# ADR-008 — Twilio SMS Delivery

## Status

Accepted as optional

## Context

Phone-first authentication requires an SMS delivery provider while OTP correctness, expiry and abuse controls must remain application-owned.

## Decision

Use Twilio as an optional SMS delivery adapter. OTP generation/validation and authentication policy stay inside the auth domain.

## Consequences

- Twilio credentials never reach the browser.
- Provider failure must not mark an OTP as verified.
- Live sender/messaging-service acceptance remains environment-specific.

## Implementation evidence

- `elitedom-store/backend/app/integrations/twilio/tasks.py`
- `elitedom-store/backend/app/modules/auth/delivery.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
