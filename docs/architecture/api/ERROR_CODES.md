---
title: "API Error Model"
status: reference
owner: architecture
document_type: api-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "API Error Model scope or referenced implementation sources change."
---

# API Error Model

## Purpose

Defines error semantics and handling expectations without freezing every error string as a public contract.

## Reference

### 400 / validation/domain input

Malformed or semantically invalid commands that cannot be accepted.

### 401 / authentication

Missing, invalid or expired authentication/session proof.

### 403 / authorization or MFA

Authenticated identity lacks required permission or required staff MFA state.

### 404 / resource

Object is absent or intentionally hidden by ownership rules.

### 409 / conflict

State transition, duplicate active claim, inventory/payment/order conflict or idempotency conflict.

### 422 / schema validation

FastAPI/Pydantic request validation failures.

### 429 / rate limit

Client exceeded configured endpoint/global rate policy.

### 503 / dependency/safety

Readiness failure or fail-closed infrastructure dependency such as configured distributed rate limiter.

## Source of truth

- `elitedom-store/backend/app/shared/exceptions.py`
- `elitedom-store/backend/app/middleware/`
- `elitedom-store/backend/app/modules/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
