---
title: "Context Map"
status: current
owner: architecture
document_type: architecture
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Context Map behavior, evidence, or source-of-truth changes."
---

# Context Map

## Purpose

Defines bounded contexts and their ownership relationships so modules do not silently share business authority.

## Current state

The FastAPI codebase is a modular monolith. Contexts are separated by module/service responsibilities while sharing one application database. External ERP/payment/notification systems are adapters, not domain owners for every concept.

## Invariants and controls

- Identity & Access owns users, sessions, OTP, social identity and staff MFA.
- Catalogue owns customer-facing product/category/content/media representation; ERP-originated catalogue data enters through controlled synchronization.
- Commerce owns carts, checkout and orders; Payments owns payment/refund state; Fulfillment owns stock/shipping transitions.
- Customer Service owns warranty/RMA; Commercial Extensions own B2B, loyalty and suppliers.
- Administration owns permissions, audit, integration visibility/configuration surfaces and launch acceptance.
- Integration adapters translate provider/ERP events into domain commands and never bypass domain authorization/state rules.

## Source of truth

- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/shared/`

## Verification

Review imports, routers, services, domain events and database ownership when a module begins reaching across contexts.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
