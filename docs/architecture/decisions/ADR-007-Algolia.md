---
title: "ADR-007 — Algolia Search Adapter"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Search provider strategy, catalogue source-of-truth, or Algolia adapter ownership materially changes."
decision_status: Accepted
---

# ADR-007 — Algolia Search Adapter

## Status

Accepted — optional capability.

## Context

The platform can benefit from an external search index for discovery performance and relevance, but customer/catalogue correctness must not depend on an always-enabled third-party service. Canonical product/catalogue data remains application/ERP-owned according to existing domain boundaries.

## Decision

Maintain Algolia behind an optional backend service/task adapter. Credentials and index administration remain server-side. Deployments may leave Algolia disabled unless the target release/environment explicitly requires the integration.

## Consequences

- Search indexing failure must not corrupt canonical catalogue data.
- Provider credentials never reach the browser.
- Index writes/retries must be observable and repeat-safe for the implemented task model.
- A deployment can remain functionally valid without Algolia when the product/release requirements permit fallback/non-Algolia discovery behavior.
- Provider enablement and relevance acceptance are environment-specific evidence, not implied by this ADR.

## Implementation evidence

- `elitedom-store/backend/app/integrations/algolia/service.py`
- `elitedom-store/backend/app/integrations/algolia/tasks.py`
- `docs/architecture/integrations/ALGOLIA.md`

## Review rule

If another search architecture replaces Algolia or search becomes a mandatory hard dependency, supersede this ADR with a new decision and preserve this record as history.
