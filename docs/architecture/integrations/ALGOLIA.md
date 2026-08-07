---
title: "Algolia Search Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Algolia Search Integration behavior, evidence, or source-of-truth changes."
---

# Algolia Search Integration

## Purpose

Documents the Algolia Search boundary, implementation status, security controls and operational enablement requirements.

## Current state

Algolia has an optional backend service/task implementation for external search indexing. Canonical catalogue data remains in PostgreSQL; Algolia is a derived search surface and may be unconfigured in environments that do not require it.

## Invariants and controls

- Admin/provider secrets remain server-side.
- Indexing failure must not corrupt or block canonical catalogue persistence.
- Reindex/update tasks should be retryable/idempotent by object identity.
- Search availability requirements must be defined per environment.

## Enablement and failure mode

Enablement requires an Algolia application/index and valid keys; production search relevance/latency is validated against the live index.

## Source of truth

- `elitedom-store/backend/app/integrations/algolia/service.py`
- `elitedom-store/backend/app/integrations/algolia/tasks.py`
- `elitedom-store/backend/app/config.py`

## Verification

Run relevant unit/integration tests and configuration validation. Enablement requires an Algolia application/index and valid keys; production search relevance/latency is validated against the live index.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
