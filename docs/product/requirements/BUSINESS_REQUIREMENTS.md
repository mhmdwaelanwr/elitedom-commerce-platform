---
title: "Business Requirements"
status: current
owner: product
document_type: requirements
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Business Requirements behavior, evidence, or source-of-truth changes."
---

# Business Requirements

## Purpose

Defines business-level outcomes the platform is expected to support without confusing them with proof of production launch.

## Current state

Stages 0–10 delivered the core commerce, identity, Paymob, fulfillment, administration, catalog/media, security/SEO and launch-control implementation. Remaining launch work is environment/provider acceptance rather than an undocumented assumption.

## Invariants and controls

- Support consumer technology-commerce journeys in English and Arabic.
- Provide staff workflows with auditable, backend-enforced authorization.
- Integrate Odoo 17 for ERP synchronization without making external retries corrupt application state.
- Use Paymob as the primary payment integration for the target market while retaining explicit migration/legacy boundaries.
- Preserve reliable order, inventory, fulfillment, refund and RMA state transitions.
- Provide production-operability controls: readiness, observability hooks, rate limiting, backups, rollback and release acceptance.
- Never represent provider configuration or a green CI run as proof of live merchant acceptance.

## Source of truth

- `docs/product/foundation/BUSINESS_CAPABILITIES.md`
- `docs/delivery/releases/`
- `elitedom-store/docs/IMPLEMENTATION_STATUS.md`

## Verification

Review capability coverage against routes/modules, release records and launch-control gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
