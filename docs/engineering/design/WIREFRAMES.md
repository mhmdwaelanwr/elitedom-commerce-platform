---
title: "Interface Architecture and Wireframe Guide"
status: reference
owner: engineering
document_type: ux-reference
verified_against: "68c1692c12809777fe0a482e35c1a618713c08bc"
review_trigger: "Interface Architecture and Wireframe Guide scope or referenced implementation sources change."
---

# Interface Architecture and Wireframe Guide

## Purpose

Documents the intended page-level information architecture for the clean-room frontend rebuild. The previous rendered UI/components were intentionally removed and are no longer authoritative.

## Clean-room status

The executable frontend is currently a minimal blank App Router baseline. The sections below describe product requirements that will be rebuilt and validated incrementally; they do not claim those screens are present in the temporary baseline.

## Reference

### Storefront shell

Header/navigation/search/account/cart plus localized content area and responsive footer.

### Discovery

Homepage merchandising, shop/catalogue listing, filters/search, pagination/empty states.

### Product

Media, title/price/availability, purchase controls, description/specification and related content.

### Checkout

Address/contact, order summary, shipping/payment selection, provider handoff and retry/status messaging.

### Account

Profile, addresses, orders and service journeys.

### Admin

Navigation shell with permission-aware sections for catalogue, operations, integrations, audit/access and launch control.

### MFA

Enrollment secret/provisioning URI, verification, one-time recovery codes and recovery-code verification.

## Source of truth

- `elitedom-store/frontend/src/app/`
- `elitedom-store/frontend/src/lib/`
- `elitedom-store/frontend/src/types/`

A reusable component directory becomes authoritative only after the new clean-room component system is created.

## Maintenance rule

This page is a curated architecture reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
