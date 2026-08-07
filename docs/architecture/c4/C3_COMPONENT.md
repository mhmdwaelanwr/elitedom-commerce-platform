---
title: "C4 Level 3 — Application Components"
status: current
owner: architecture
document_type: c4
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "C4 Level 3 — Application Components behavior, evidence, or source-of-truth changes."
---

# C4 Level 3 — Application Components

## Purpose

Describes the principal FastAPI and frontend components within the application containers.

## Current state

FastAPI is organized into domain modules (`auth`, `products`, `orders`, `customers`, `inventory`, `payments`, `shipping`, `warranty`, `suppliers`, `loyalty`, `b2b`, `reporting`, `admin`) plus external integration adapters, shared security/events/outbox primitives and middleware. The frontend uses App Router pages, reusable components, typed API/helpers and shared types.

## Invariants and controls

- Routers translate HTTP to domain/service calls; privileged business rules stay server-side.
- Integration adapters translate external protocols and preserve idempotency/authenticity boundaries.
- Shared code must remain infrastructure/domain-neutral enough to avoid circular ownership.
- Admin UI permission visibility never replaces backend permission enforcement.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/frontend/src/`

## Verification

Run backend/frontend CI and review module ownership when component dependencies change.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
