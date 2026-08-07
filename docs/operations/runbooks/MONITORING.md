---
title: "Monitoring Runbook"
status: current
owner: operations
document_type: runbook
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Monitoring Runbook behavior, evidence, or source-of-truth changes."
---

# Monitoring Runbook

## Purpose

Defines the minimum operational signals and triage flow.

## Current state

FastAPI exposes liveness/readiness and metrics when enabled; request IDs/structured logs and optional OpenTelemetry provide diagnostic context. Monitoring backends/dashboards/alerts are deployment-specific.

## Invariants and controls

- Monitor customer/API availability separately from dependency readiness.
- Track HTTP error/latency/rate-limit behavior, database/Redis health, worker backlog/failures and provider webhook/task failures.
- Protect metrics access and avoid secret/PII labels.
- Correlate incidents with release reference and request/event identifiers.

## Source of truth

- `elitedom-store/backend/app/observability.py`
- `elitedom-store/backend/app/health.py`
- `docs/operations/observability/`

## Verification

Exercise alerts in staging and attach monitoring/alert acceptance to launch evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
