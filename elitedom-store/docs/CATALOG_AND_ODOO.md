---
title: "Catalogue and Odoo Ownership"
status: reference
owner: architecture
document_type: implementation-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Catalogue and Odoo Ownership scope or referenced implementation sources change."
---

# Catalogue and Odoo Ownership

## Purpose

Clarifies catalogue ownership between customer-facing FastAPI data and Odoo ERP synchronization.

## Reference

### Customer catalogue

FastAPI exposes/publicates customer-facing catalogue/content/media with publication and media validation rules.

### ERP input

Odoo product/inventory updates enter through signed/idempotent integration paths using stable identifiers such as SKU/external IDs.

### Inventory

Stock changes are server/ERP-controlled and reconciled; browser catalogue state is not stock authority.

### Content/media

Staff administration can manage customer-facing content/media; object storage is a media boundary, not an ERP database.

### Failure

Odoo unavailability/retries must not duplicate catalogue/inventory/order effects.

## Source of truth

- `elitedom-store/backend/app/modules/products/`
- `elitedom-store/backend/app/integrations/odoo/catalog_webhooks.py`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
