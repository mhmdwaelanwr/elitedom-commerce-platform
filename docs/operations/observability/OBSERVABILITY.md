---
title: "Observability Architecture"
status: current
owner: operations
document_type: observability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Observability Architecture behavior, evidence, or source-of-truth changes."
---

# Observability Architecture

## Purpose

Defines how logs, metrics, traces and health signals combine to explain platform behavior.

## Current state

FastAPI configures request context/structured logging, Prometheus-compatible metrics and optional OpenTelemetry export. Liveness/readiness are explicit endpoints. Provider/worker/Odoo observability depends on application logs/tasks and deployment tooling.

## Invariants and controls

- Use request/event IDs for correlation across boundaries.
- Mask secrets and minimize PII in logs/labels/traces.
- Protect metrics with bearer auth when configured/required.
- Do not use liveness as dependency readiness.
- Sampling/export failure must not make business requests falsely succeed or fail unless intentionally configured.

## Source of truth

- `elitedom-store/backend/app/observability.py`
- `elitedom-store/backend/app/health.py`
- `elitedom-store/backend/app/config.py`

## Verification

Inspect generated metrics/logs/traces in staging and verify alert coverage.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
