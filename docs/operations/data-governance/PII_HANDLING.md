---
title: "PII Handling"
status: current
owner: operations
document_type: data-governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "PII Handling behavior, evidence, or source-of-truth changes."
---

# PII Handling

## Purpose

Defines engineering controls for personal data in requests, storage, logs, support and provider integrations.

## Current state

Customer identity/profile/contact/address/order/RMA data may be personal data. The application enforces authenticated/object-level access in domain routes/services; logging/metrics should minimize personal identifiers.

## Invariants and controls

- Do not log full tokens, OTPs, recovery codes, passwords or unnecessary customer payloads.
- Mask/minimize email and phone in operational logs.
- Only send provider data required for the integration purpose.
- Test fixtures use synthetic data.
- Data exports/deletion/support operations require authorization and audit appropriate to the implemented workflow.

## Source of truth

- `elitedom-store/backend/app/modules/customers/`
- `elitedom-store/backend/app/modules/auth/`
- `elitedom-store/backend/app/observability.py`

## Verification

Review representative logs/provider requests and authorization tests for new PII-bearing flows.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
