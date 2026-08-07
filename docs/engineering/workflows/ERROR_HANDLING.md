---
title: "Error Handling and Resilience"
status: current
owner: engineering
document_type: domain-rules
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Error Handling and Resilience behavior, evidence, or source-of-truth changes."
---

# Error Handling and Resilience

## Purpose

Defines error-handling policy across HTTP, database, worker and provider boundaries.

## Current state

The platform distinguishes validation/auth/conflict errors from infrastructure/provider failures. Security-sensitive dependencies fail closed; asynchronous provider work uses retries/outbox where appropriate rather than hiding errors.

## Invariants and controls

- Return stable client-safe errors; do not leak credentials, SQL details or stack traces in production.
- Use bounded timeouts for provider/readiness calls.
- Retry only operations with known idempotency semantics and bounded policies.
- Mark/log failures with request/event identifiers and masked fields.
- Do not convert provider failure into false success or duplicated business state.
- Readiness returns 503 when required dependencies are unavailable.

## Source of truth

- `elitedom-store/backend/app/shared/exceptions.py`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/health.py`
- `elitedom-store/backend/app/shared/outbox_tasks.py`

## Verification

Test failure, timeout and duplicate paths; inspect logs/metrics in staging.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
