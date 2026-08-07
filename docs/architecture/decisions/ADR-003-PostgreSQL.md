---
title: "ADR-003 — PostgreSQL 15"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-003 — PostgreSQL 15

## Status

Accepted

## Context

Commerce requires transactional consistency, constraints, relational queries and mature operational tooling.

## Decision

Use PostgreSQL 15 for application persistence and for Odoo's database server, with distinct database names for the application and ERP.

## Consequences

- Alembic governs application schema evolution.
- Fresh/latest/full migration replay is a CI gate.
- Application and Odoo schemas must not be conflated.

## Implementation evidence

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/backend/alembic/`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
