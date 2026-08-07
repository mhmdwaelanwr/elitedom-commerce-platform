---
title: "Database Specification"
status: current
owner: architecture
document_type: database
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Database Specification behavior, evidence, or source-of-truth changes."
---

# Database Specification

## Purpose

Defines database topology, ownership and safety rules. Exact schema is executable in Alembic/SQLAlchemy rather than manually duplicated as a second source of truth.

## Current state

One PostgreSQL 15 service hosts distinct databases for Odoo and the FastAPI application. `APP_POSTGRES_DB` must differ from `ODOO_DB`; FastAPI uses SQLAlchemy/Alembic and Odoo owns its own schema lifecycle.

## Invariants and controls

- Never make application features depend on direct reads/writes to Odoo tables.
- Application schema changes use Alembic and must replay from fresh/head/base in CI.
- Foreign keys, uniqueness and indexes should enforce invariants that are unsafe to rely on application code alone.
- Money/state/provider identifiers use explicit types/constraints and domain transitions.
- Production credentials and database URLs are runtime configuration, not documentation literals.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/models.py`

## Verification

Run the PostgreSQL migration smoke job: fresh upgrade, latest downgrade/replay and full downgrade/replay.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
