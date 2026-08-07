---
title: "ADR-001 — Odoo 17 for ERP"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-001 — Odoo 17 for ERP

## Status

Accepted

## Context

The platform needs ERP-grade product, sales, stock and delivery capabilities while keeping customer-facing application behavior independently evolvable.

## Decision

Use Odoo 17 Community as the ERP boundary and ship a repository-owned `elitedom_connector` addon for signed catalogue, inventory, order and shipment events. Keep the FastAPI application database separate from the Odoo database.

## Consequences

- ERP synchronization is an integration boundary, not a shared-database shortcut.
- Connector installation/tests are part of CI.
- Failures require retry/idempotency rather than cross-database transactions.

## Implementation evidence

- `elitedom-store/odoo/addons/elitedom_connector/__manifest__.py`
- `elitedom-store/backend/app/integrations/odoo/`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
