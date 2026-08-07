---
title: "Requirements Traceability Matrix"
status: reference
owner: product
document_type: traceability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Requirements Traceability Matrix scope or referenced implementation sources change."
---

# Requirements Traceability Matrix

## Purpose

Maps high-level requirement families to implementation and verification so planned behavior is not mistaken for delivered behavior.

## Reference

### Identity & MFA

Implementation: `backend/app/modules/auth/`, frontend auth/MFA routes. Evidence: backend auth/MFA tests, Stage 4/9 records.

### Commerce & catalogue

Implementation: product/catalog/order modules and storefront. Evidence: backend/frontend CI, Stage 2/3/8 records.

### Payments

Implementation: payments module + Paymob adapter/webhook. Evidence: integration tests, Stage 5 record; live provider acceptance remains manual.

### Fulfillment & Odoo

Implementation: inventory/shipping/order modules + Odoo connector. Evidence: Odoo clean install/tests, Stage 6 record.

### Admin/RBAC/audit

Implementation: admin modules/control plane. Evidence: Stage 7 integration tests and audit behavior.

### Security/performance/SEO

Implementation: middleware/config/media/frontend metadata. Evidence: Stage 9 tests and CI.

### Launch acceptance

Implementation: launch acceptance persistence/API/UI + smoke workflow. Evidence: Stage 10 tests and launch-acceptance CI.

## Source of truth

- `.github/workflows/ci.yml`
- `docs/delivery/releases/`
- `elitedom-store/backend/app/tests/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
