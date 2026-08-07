---
title: "Dashboard Standard"
status: reference
owner: operations
document_type: observability-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Dashboard Standard scope or referenced implementation sources change."
---

# Dashboard Standard

## Purpose

Defines dashboard content expected for operations; it does not claim a particular Grafana/hosted dashboard is provisioned.

## Reference

### Service health

Traffic, success/error rate, latency percentiles, liveness/readiness.

### Dependencies

PostgreSQL/Redis resource/connection health and readiness failures.

### Async work

Celery throughput, retries/failures/backlog; Odoo/outbox delivery state.

### Commerce

Payment callback/refund failure rates and order/fulfillment anomalies using non-sensitive aggregates.

### Release view

Current release/environment markers and change/incident annotations where tooling supports them.

## Source of truth

- `docs/operations/observability/METRICS.md`
- `docs/operations/observability/LOGGING.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
