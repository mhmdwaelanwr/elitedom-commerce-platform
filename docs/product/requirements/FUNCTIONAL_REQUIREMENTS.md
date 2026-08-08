---
title: "Functional Requirements"
status: current
owner: product
document_type: requirements
verified_against: "3206626bc721deda261c6c6682f5d63c79308f52"
review_trigger: "Functional Requirements behavior, evidence, or source-of-truth changes."
---

# Functional Requirements

## Purpose

Captures functional behavior by bounded capability and links it to the executable modules that implement it.

## Current state

The current platform exposes versioned APIs, React Router storefront/admin routes, background integration workers and Odoo connector behavior. Exact request/response fields are owned by FastAPI schemas/OpenAPI rather than duplicated manually here.

## Invariants and controls

- Identity: registration/sign-in, phone OTP verification, OAuth identity handling, refresh/session lifecycle and staff MFA.
- Catalogue: public products/catalogue, categories, discovery, content/media administration and publication state.
- Commerce: carts, checkout, orders and customer account/order history.
- Payments: Paymob initiation/callback processing, payment transitions, refunds and reconciliation-safe records.
- Fulfillment: inventory, shipment/tracking lifecycle, Odoo order/inventory/catalogue events.
- Service: warranty checks, RMA submission/review, supplier, loyalty and B2B workflows.
- Administration: permission-protected operations, role/permission configuration, audit, integrations and launch control.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/frontend/src/pages/`
- `elitedom-store/frontend/src/router.tsx`

## Verification

Generate/review FastAPI OpenAPI in development, run backend/frontend CI, and map changed functions to requirements in the traceability matrix.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.