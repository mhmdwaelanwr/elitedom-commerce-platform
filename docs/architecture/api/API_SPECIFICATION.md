---
title: "API Specification"
status: current
owner: architecture
document_type: api
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "API Specification behavior, evidence, or source-of-truth changes."
---

# API Specification

## Purpose

Defines stable API conventions and the current route families. FastAPI OpenAPI generated from code is authoritative for exact schemas.

## Current state

The public/application API is versioned under `/api/v1`. In development with debug enabled, FastAPI exposes generated OpenAPI/Swagger documentation. Production disables interactive docs by default through application configuration.

## Invariants and controls

- Versioned route families include auth, products, catalog, orders, customers, inventory, payments, shipping, warranty, suppliers, loyalty, B2B, reports and admin.
- Webhook routes are separate trust boundaries for Paymob, Odoo and legacy Stripe compatibility.
- HTTP status and error handling must not leak secrets, database internals or provider credentials.
- Authentication/permission requirements are enforced by backend dependencies/services.
- Schema changes should remain backward-aware and documented when clients must adapt.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/integrations/`

## Verification

Run the app in development and inspect `/openapi.json`; run backend tests and frontend type/build checks.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
