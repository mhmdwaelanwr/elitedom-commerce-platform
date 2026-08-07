---
title: "ADR-010 — Hybrid Inventory and Dropship Model"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-010 — Hybrid Inventory and Dropship Model

## Status

Accepted

## Context

Technology retail may combine owned/ERP stock with supplier/dropship sourcing while checkout must still use authoritative availability rules.

## Decision

Represent supplier mappings and hybrid stock decisions in application/ERP integration logic; never trust browser-supplied availability or supplier claims without server validation.

## Consequences

- Inventory transitions remain explicit.
- Supplier availability does not bypass order validation.
- Odoo synchronization and application state require idempotent reconciliation.

## Implementation evidence

- `elitedom-store/backend/app/modules/inventory/`
- `elitedom-store/backend/app/modules/suppliers/`
- `elitedom-store/backend/app/integrations/odoo/`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
