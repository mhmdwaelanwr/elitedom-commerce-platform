---
title: "Database Schema Guide"
status: reference
owner: architecture
document_type: database-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Database Schema Guide scope or referenced implementation sources change."
---

# Database Schema Guide

## Purpose

Provides a domain-oriented schema map. It deliberately avoids copying every column because migrations/models are authoritative.

## Reference

### Identity and access

Users/customers, auth sessions, OTP/social identity data, staff MFA, roles/permissions and audit records.

### Catalogue and inventory

Product/category/content/media records, stock/serial structures, supplier mappings and ERP identifiers.

### Commerce

Carts, cart lines, customer addresses, sale orders/order lines, totals/currency and fulfillment references.

### Payments

Legacy Stripe event history, Paymob payment attempts/records, refund/refund-request state and provider identifiers.

### Reliability

Webhook receipt/idempotency data, transactional outbox and delivery/retry state.

### Administration and launch

Configuration/control-plane data and release/environment-scoped launch-acceptance evidence.

## Source of truth

- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/models.py`
- `elitedom-store/backend/app/modules/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
