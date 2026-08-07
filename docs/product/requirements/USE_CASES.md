---
title: "Use Cases"
status: reference
owner: product
document_type: use-cases
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Use Cases scope or referenced implementation sources change."
---

# Use Cases

## Purpose

Summarizes primary user and operator journeys without duplicating UI implementation detail.

## Reference

### UC-01 Browse and buy

Customer discovers a product, manages cart, checks out, initiates a supported payment method, and receives server-authoritative order/payment state.

### UC-02 Phone-first identity

Customer requests an OTP, verifies it under expiry/cooldown/abuse controls, and obtains or links an application identity/session.

### UC-03 Account management

Customer manages profile/addresses, views orders and continues authenticated commerce journeys.

### UC-04 Fulfillment

Staff/system processes inventory and shipment state while Odoo synchronization remains idempotent and retry-safe.

### UC-05 Refund

Authorized staff/customer workflow creates a refund request and provider/domain state transitions preserve auditability.

### UC-06 Warranty/RMA

Owner of a completed eligible order submits evidence; staff reviews only valid transitions.

### UC-07 Catalog administration

Authorized staff updates content/media/publication without bypassing permission checks.

### UC-08 Launch approval

Operator selects release reference/environment, resolves automatic blockers and records evidence-backed manual gates.

## Source of truth

- `elitedom-store/frontend/src/app/`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/modules/admin/launch_service.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
