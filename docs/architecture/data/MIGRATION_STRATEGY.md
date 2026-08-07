---
title: "Migration Strategy"
status: current
owner: architecture
document_type: database
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Migration Strategy behavior, evidence, or source-of-truth changes."
---

# Migration Strategy

## Purpose

Defines the repository contract for application schema evolution.

## Current state

Alembic revisions are append-only historical artifacts. The repository currently carries migrations from the initial schema through customer portal, legacy Stripe events, Odoo receipts/outbox, hybrid dropship, auth/OTP, Paymob, fulfillment, RBAC/audit, catalog/media, staff MFA and launch acceptance.

## Invariants and controls

- Never edit old migrations merely to make history look cleaner after they are part of the shared chain.
- Every new revision has one clear `down_revision` and a usable downgrade unless an explicitly reviewed exception is unavoidable.
- Use deterministic names for constraints/indexes required by downgrade.
- Do not depend on untracked production state or real provider credentials.
- CI must upgrade fresh → head, downgrade latest/replay, downgrade base/replay.

## Source of truth

- `elitedom-store/backend/alembic.ini`
- `elitedom-store/backend/alembic/versions/`
- `.github/workflows/ci.yml`

## Verification

Run `python -m alembic heads --verbose`, history, and CI replay against PostgreSQL 15.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
