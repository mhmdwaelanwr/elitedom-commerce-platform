---
title: "API Versioning Policy"
status: current
owner: architecture
document_type: api
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "API Versioning Policy behavior, evidence, or source-of-truth changes."
---

# API Versioning Policy

## Purpose

Defines compatibility expectations for the `/api/v1` surface.

## Current state

The current HTTP API uses `/api/v1`. Internal implementation refactors do not require a new version when request/response semantics remain compatible; breaking client contracts require an explicit migration/versioning plan.

## Invariants and controls

- Do not create `/v2` merely for code cleanup.
- Additive optional fields/endpoints may remain in v1 when existing clients continue to function.
- Removing/renaming required fields, changing meaning/types or security semantics requires coordinated client migration.
- Webhook provider contracts are versioned by provider behavior/configuration and must be independently compatibility-tested.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/frontend/src/lib/`

## Verification

Frontend production build and backend integration tests are minimum compatibility gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
