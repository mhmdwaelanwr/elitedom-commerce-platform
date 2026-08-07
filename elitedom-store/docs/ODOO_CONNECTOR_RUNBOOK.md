---
title: "Odoo Connector Runbook"
status: current
owner: operations
document_type: implementation-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Odoo Connector Runbook behavior, evidence, or source-of-truth changes."
---

# Odoo Connector Runbook

## Purpose

Defines operator checks for Odoo↔FastAPI synchronization and retry handling.

## Current state

The Odoo 17 addon emits signed catalogue/inventory/order/shipment events and maintains delivery/outbox retry state. FastAPI receives Odoo callbacks through dedicated verified/idempotent routes.

## Invariants and controls

- Confirm connector addon installed and enabled only with valid endpoint/secret.
- Check FastAPI readiness before blaming Odoo delivery.
- Inspect outbox delivery state/attempts without exposing webhook secret.
- Do not manually replay by creating new semantic events when an idempotent retry path exists.
- Reconcile SKU/order/shipment external IDs before manual correction.

## Source of truth

- `elitedom-store/odoo/addons/elitedom_connector/`
- `elitedom-store/backend/app/integrations/odoo/`
- `elitedom-store/infrastructure/docker-compose.yml`

## Verification

CI proves clean install/tests; staging proves real signed delivery and retry/recovery.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
