---
title: "C4 Level 1 — System Context"
status: current
owner: architecture
document_type: c4
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "C4 Level 1 — System Context behavior, evidence, or source-of-truth changes."
---

# C4 Level 1 — System Context

## Purpose

Shows Elitedom in relation to people and external systems. This is a logical context view, not proof that every optional provider is enabled in production.

## Current state

Primary actors are customers, staff and release/operators. Core external systems are Odoo and Paymob. Twilio, SendGrid, ZeptoMail and Algolia have optional adapter implementations. Google/Apple provide external identity. Stripe remains a legacy payment boundary. Hedera is a disabled scaffold; Zoho and Typeform are not current runtime-critical integrations.

## Invariants and controls

- External systems are untrusted boundaries and require authentication/signature/provider validation as applicable.
- Provider availability must not grant authorization or directly set trusted commerce state from the browser.
- Optional integrations may be disabled without invalidating core local development.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/config.py`

## Verification

Compare context actors/systems with imported provider adapters, configuration flags and current launch gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
