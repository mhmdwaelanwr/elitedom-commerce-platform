---
title: "Odoo Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Odoo Integration behavior, evidence, or source-of-truth changes."
---

# Odoo Integration

## Purpose

Documents the Odoo boundary, implementation status, security controls and operational enablement requirements.

## Current state

Odoo 17 Community is an implemented ERP boundary. The repository ships `elitedom_connector` 17.0.2.0.0 and FastAPI adapters for catalogue, inventory, order and shipment synchronization. The connector uses signed webhooks and outbox/retry behavior; FastAPI maintains idempotent receipts/processing.

## Invariants and controls

- FastAPI application and Odoo databases remain distinct.
- `ODOO_SYNC_ENABLED`/`ODOO_WEBHOOKS_ENABLED` gate integration behavior.
- API key and webhook secret must be non-placeholder when their features are enabled.
- Odoo-originated events never bypass FastAPI domain validation.

## Enablement and failure mode

CI installs the addon in a clean Odoo 17 database and runs native module tests; staging must additionally prove real endpoint connectivity and signed event delivery.

## Source of truth

- `elitedom-store/odoo/addons/elitedom_connector/`
- `elitedom-store/backend/app/integrations/odoo/`
- `elitedom-store/backend/app/config.py`

## Verification

Run relevant unit/integration tests and configuration validation. CI installs the addon in a clean Odoo 17 database and runs native module tests; staging must additionally prove real endpoint connectivity and signed event delivery.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
