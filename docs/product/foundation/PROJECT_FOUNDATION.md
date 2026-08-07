---
title: "Project Foundation"
status: current
owner: product
document_type: product-foundation
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Project Foundation behavior, evidence, or source-of-truth changes."
---

# Project Foundation

## Purpose

Defines the stable mission, scope, product boundaries and non-negotiable engineering principles for Elitedom.

## Current state

Elitedom is an Egyptian technology-commerce platform combining a customer storefront, staff control plane, application API, ERP synchronization, payment orchestration and operational launch controls. The repository is a modular monorepo; it is not a collection of independent demo applications.

## Invariants and controls

- Customer-facing commerce and staff operations share server-authoritative domain rules.
- Odoo is an ERP integration and operational system of record for selected ERP concepts; the FastAPI application owns web-facing application behavior and its own PostgreSQL schema.
- Paymob is the primary payment integration; legacy Stripe compatibility is isolated and documented as superseded architecture.
- Arabic/English, RTL/LTR and light/dark/system are product-level compatibility requirements, not optional polish.
- Production readiness is release-specific and evidence-based.

## Source of truth

- `README.md`
- `elitedom-store/backend/app/main.py`
- `elitedom-store/frontend/src/app/`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Verification

Verify repository structure, API/router inventory, frontend routes, Odoo manifest and launch-control documentation.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
