---
title: "Security Requirements"
status: current
owner: product
document_type: requirements
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Security Requirements behavior, evidence, or source-of-truth changes."
---

# Security Requirements

## Purpose

Defines security requirements that architecture, implementation, tests and operations must jointly satisfy.

## Current state

Security controls are defense-in-depth: production configuration validation, backend RBAC, staff MFA, session persistence, webhook authenticity/idempotency, rate limiting, defensive headers, protected metrics and secret discipline.

## Invariants and controls

- Authenticate and authorize every privileged operation server-side.
- Require staff MFA in staging/production and bind privileged checks to persisted session state.
- Store TOTP seeds encrypted and recovery codes non-reversibly; never expose them after enrollment except one-time recovery display.
- Verify provider webhooks before state mutation and make processing idempotent.
- Use Redis-backed rate limiting in staging/production and fail closed when the configured limiter is unavailable.
- Reject weak/placeholder production secrets, wildcard hosts/CORS, invalid enabled providers and unsafe service URLs.
- Protect metrics with a strong bearer credential when enabled outside development.
- Do not store payment card data in Elitedom application tables or logs.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/app/shared/security.py`
- `elitedom-store/backend/app/modules/auth/`
- `elitedom-store/backend/app/integrations/`
- `SECURITY.md`

## Verification

Run backend security tests, configuration tests, integration-safety tests and launch acceptance. Provider/live penetration testing is separate release evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
