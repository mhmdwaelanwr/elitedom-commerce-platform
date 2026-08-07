---
title: "ADR-007 — Algolia Search Adapter"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted as optional
---

# ADR-007 — Algolia Search Adapter

## Status

Accepted as optional

## Context

The platform benefits from an external search-index integration without making storefront correctness depend on an always-enabled third-party service.

## Decision

Maintain Algolia behind an optional backend integration/service/task boundary. Core catalogue persistence remains in the application database; enabling Algolia requires environment credentials.

## Consequences

- Search indexing failures must not corrupt canonical catalogue data.
- Secrets stay server-side.
- Deployment may run with Algolia unconfigured unless launch requirements explicitly enable it.

## Implementation evidence

- `elitedom-store/backend/app/integrations/algolia/service.py`
- `elitedom-store/backend/app/integrations/algolia/tasks.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
