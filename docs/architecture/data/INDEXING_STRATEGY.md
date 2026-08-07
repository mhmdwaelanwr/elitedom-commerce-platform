---
title: "Indexing Strategy"
status: current
owner: architecture
document_type: database
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Indexing Strategy behavior, evidence, or source-of-truth changes."
---

# Indexing Strategy

## Purpose

Defines how indexing decisions are made without claiming indexes that are not present in migrations.

## Current state

Indexes are created through Alembic with query patterns, uniqueness and operational write cost in mind. Provider/search indexes such as Algolia are secondary derived indexes, not replacements for database constraints.

## Invariants and controls

- Use unique constraints/indexes for provider/event/idempotency keys that must not duplicate.
- Index common ownership, status, timestamp and external-ID filters only when query evidence justifies them.
- Prefer compound indexes matching actual filter/order patterns.
- Do not add redundant indexes hidden inside ORM definitions without migration review.
- Measure slow queries in the target environment before large speculative indexing changes.

## Source of truth

- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/modules/`

## Verification

Migration CI proves schema creation/replay; query plans/load evidence justify performance changes.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
