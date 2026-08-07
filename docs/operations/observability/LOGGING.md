---
title: "Logging Standard"
status: current
owner: operations
document_type: observability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Logging Standard behavior, evidence, or source-of-truth changes."
---

# Logging Standard

## Purpose

Defines structured, safe logging requirements.

## Current state

Production logging is intended to be machine-readable with request correlation and masking. Logs support diagnosis/audit but are not an authorization or payment source of truth.

## Invariants and controls

- Include timestamp/severity/service/request or event identifier where available.
- Never log passwords, JWTs, MFA seeds/recovery codes, provider secret keys or raw sensitive headers.
- Mask/minimize email/phone and provider payload data.
- Log state-transition failures with IDs, not entire sensitive objects.
- Keep exception context sufficient for diagnosis without exposing stack traces to API clients.

## Source of truth

- `elitedom-store/backend/app/observability.py`
- `elitedom-store/backend/app/middleware/`
- `elitedom-store/backend/app/integrations/`

## Verification

Review staging logs during auth/payment/webhook/error scenarios and validate masking.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
