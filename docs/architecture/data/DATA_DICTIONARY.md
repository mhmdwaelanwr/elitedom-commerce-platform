---
title: "Data Dictionary"
status: reference
owner: architecture
document_type: data-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Data Dictionary scope or referenced implementation sources change."
---

# Data Dictionary

## Purpose

Defines the meaning and sensitivity of important logical data groups. Field-level names/types are sourced from schemas/models.

## Reference

### Identity data

Account identifiers, email/phone/profile details, session metadata. Treat as personal/confidential according to use.

### Authentication secrets

Password hashes, token/session material, OTP hashes, encrypted MFA seed and recovery-code hashes. Restricted.

### Commerce data

Cart/order items, prices, discounts, shipping and currency. Business-confidential and customer-associated.

### Payment data

Provider IDs, attempts, statuses, callback metadata and refund references. Do not store raw card data.

### Inventory/serial data

SKU/product/stock/lot/serial relationships and ERP IDs. Internal/business data; serials can become customer-associated.

### RMA/support data

Claim reason, evidence URL, resolution notes and ownership links. May contain personal/support content.

### Audit/launch evidence

Actor, action, timestamps, evidence references and release/environment identifiers. Integrity-sensitive.

## Source of truth

- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/alembic/versions/`
- `docs/operations/data-governance/DATA_CLASSIFICATION.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
