---
title: "Database Relationship Map"
status: reference
owner: architecture
document_type: database-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Database Relationship Map scope or referenced implementation sources change."
---

# Database Relationship Map

## Purpose

Summarizes important aggregate relationships; use migrations/models for exact cardinality and constraint names.

## Reference

### Customer → Cart/Order/Address

Customer identity owns account-scoped commerce objects; object-level authorization is enforced in services/routers.

### Order → Order lines → Product

Orders persist server-authoritative commercial snapshots and item relationships.

### Order → Payment/Refund

Payment attempts/results and refunds remain related to orders but follow independent provider/state transitions.

### Product → Category/Media/Inventory

Catalogue representation links to categorized content/media and inventory/serial data.

### Order/Product → RMA

Warranty claims require owned completed-order/product eligibility and optional serial ownership.

### Integration event → Receipt/Outbox

External events/deliveries use idempotency/outbox records to prevent duplicate effects.

### Release → Launch gate

Launch acceptance is unique by release reference, environment and gate key.

## Source of truth

- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/modules/*/models.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
