---
title: "Test Case Catalogue"
status: reference
owner: engineering
document_type: testing-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Test Case Catalogue scope or referenced implementation sources change."
---

# Test Case Catalogue

## Purpose

Indexes critical scenario families; executable test files remain authoritative for exact cases.

## Reference

### Authentication

Password/phone OTP/social identity, refresh/session revocation, MFA enrollment/verify/recovery, permission boundaries.

### Payments

Paymob initiation/config/HMAC/idempotency/state transitions/refunds; legacy compatibility isolation.

### Commerce

Cart ownership/merge, totals, orders, inventory conflicts and fulfillment transitions.

### Integrations

Odoo signed webhooks/receipts/outbox, optional-provider safety and fail-closed configuration.

### Catalog/media

Validation, publication/content, media type/size/path/object-storage lifecycle.

### Admin

RBAC/permissions, audit, configuration/integration surfaces and forged-role rejection.

### Launch

Release/environment evidence isolation, required evidence/waiver rationale and live-smoke asset safeguards.

## Source of truth

- `elitedom-store/backend/app/tests/`
- `elitedom-store/odoo/addons/elitedom_connector/tests/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
