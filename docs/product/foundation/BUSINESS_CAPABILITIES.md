---
title: "Business Capabilities"
status: reference
owner: product
document_type: capability-model
verified_against: "3206626bc721deda261c6c6682f5d63c79308f52"
review_trigger: "Business Capabilities scope or referenced implementation sources change."
---

# Business Capabilities

## Purpose

Provides a capability map aligned with the current application modules and customer/staff journeys.

## Reference

### Commerce discovery

Catalogue publication, categories, search/filtering, product detail, media and SEO.

### Customer identity

Registration/sign-in, phone OTP, Google/Apple identity flows, sessions, profile and addresses.

### Cart and checkout

Guest/account carts, cart merging, server-authoritative totals, checkout and payment initiation.

### Payments

Paymob attempts/callbacks, payment-state transitions, refunds/reconciliation controls; legacy Stripe compatibility remains non-primary.

### Fulfillment

Order lifecycle, stock/reservation semantics, shipment/tracking operations and Odoo synchronization.

### Customer service

Order history, warranty eligibility, RMA intake/review and support-facing controls.

### Commercial operations

B2B RFQ, suppliers, loyalty and administrative configuration.

### Administration

RBAC, permissions, audit logs, integration visibility, catalog/content controls and launch acceptance.

### Platform operations

Health/readiness, metrics, rate limiting, object media, backup/recovery, deployment and smoke validation.

## Source of truth

- `elitedom-store/backend/app/modules/`
- `elitedom-store/frontend/src/pages/`
- `elitedom-store/frontend/src/router.tsx`
- `elitedom-store/backend/app/modules/admin/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.