---
title: "Distributed Tracing"
status: reference
owner: operations
document_type: observability-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Distributed Tracing scope or referenced implementation sources change."
---

# Distributed Tracing

## Purpose

Documents optional OpenTelemetry trace export and safe usage.

## Reference

### Configuration

`OTEL_SERVICE_NAME`, exporter endpoint and trace sample ratio configure optional export.

### Safety

Exporter URL must be HTTPS or an allowed internal service URL. Spans must not include secrets/payment/auth material.

### Scope

Tracing helps correlate FastAPI requests and integration latency but does not replace provider receipts, audit logs or database state.

### Sampling

Production sampling is an operational trade-off; a trace sample ratio is not an SLO.

## Source of truth

- `elitedom-store/backend/app/observability.py`
- `elitedom-store/backend/app/config.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
