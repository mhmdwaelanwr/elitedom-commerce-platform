---
title: "Metrics Standard"
status: current
owner: operations
document_type: observability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Metrics Standard behavior, evidence, or source-of-truth changes."
---

# Metrics Standard

## Purpose

Defines metrics exposure and safe metric design.

## Current state

FastAPI metrics can be enabled and are protected by a bearer token in hardened environments. Metrics should describe rate, errors, duration and dependency/work queues without high-cardinality secrets/PII.

## Invariants and controls

- Protect `/metrics`; production config requires a strong token when metrics are enabled.
- Prefer bounded labels such as route/method/status, not customer/order IDs.
- Track readiness/dependency/provider/work-queue symptoms without exposing credentials.
- Treat metrics absence/export failure separately from application readiness unless policy explicitly couples them.

## Source of truth

- `elitedom-store/backend/app/observability.py`
- `elitedom-store/backend/app/middleware/security_headers.py`
- `elitedom-store/backend/app/config.py`

## Verification

Query metrics in staging using authorized scraper credentials and verify dashboards/alerts.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
