---
title: "Domain Model"
status: reference
owner: architecture
document_type: domain-model
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Domain Model scope or referenced implementation sources change."
---

# Domain Model

## Purpose

Summarizes major domain aggregates and relationships. Alembic migrations and SQLAlchemy models are authoritative for exact columns/constraints.

## Reference

### Identity

Customer/staff identities, auth sessions, OTP records and staff MFA credentials.

### Catalogue

Products/templates, categories, publication/content data, media and inventory-facing identifiers.

### Commerce

Cart/cart lines, sale orders/order lines, currency/totals and customer addresses.

### Payments

Payment records/attempts/events, provider identifiers, refunds/refund requests and transition metadata.

### Fulfillment

Inventory/stock lots, shipment/tracking data and ERP synchronization references.

### Service

Warranty eligibility, RMA tickets and review transitions.

### Administration

Roles/permissions, audit log/configuration/control-plane data and release-scoped launch acceptance.

### Integration reliability

Webhook receipts, transactional outbox records and provider/ERP delivery identifiers.

## Source of truth

- `elitedom-store/backend/app/models.py`
- `elitedom-store/backend/app/modules/*/models.py`
- `elitedom-store/backend/alembic/versions/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
