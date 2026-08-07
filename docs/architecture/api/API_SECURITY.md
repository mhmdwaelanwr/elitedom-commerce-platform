---
title: "API Security"
status: current
owner: architecture
document_type: api
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "API Security behavior, evidence, or source-of-truth changes."
---

# API Security

## Purpose

Defines API trust boundaries and security controls currently enforced by the backend.

## Current state

Requests pass through CORS, optional TrustedHost outside development, distributed/in-memory rate limiting by environment, protected metrics, security headers and request-context middleware. Authentication and authorization are domain-specific and persisted session state is used for sensitive staff checks.

## Invariants and controls

- Staging/production disallow wildcard hosts/CORS and require staff MFA/Redis rate limiting.
- Privileged routes require backend permissions; frontend route hiding is not authorization.
- Sensitive authentication/MFA responses use no-store caching behavior where applicable.
- Webhook routes verify authenticity before applying domain state and are idempotent.
- `/health/live` is process liveness; `/health/ready` includes dependency readiness and may return 503.
- Metrics require a bearer token when configured/required.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/app/middleware/`
- `elitedom-store/backend/app/modules/auth/`
- `elitedom-store/backend/app/main.py`

## Verification

Run backend security/config/integration tests and inspect middleware/order during architecture review.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
