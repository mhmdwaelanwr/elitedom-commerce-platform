---
title: "User Flows"
status: reference
owner: engineering
document_type: ux-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "User Flows scope or referenced implementation sources change."
---

# User Flows

## Purpose

Maps major frontend journeys to backend authority and error states.

## Reference

### Discovery → product

Home/shop/search/filter → product detail → cart. Empty/error/loading catalogue states remain usable.

### Guest cart → identity

Anonymous cart persists and safely merges when the user authenticates.

### Checkout → payment

Checkout submits authoritative server state → Paymob initiation → redirect/status UX → verified backend payment outcome.

### Phone auth

Phone input → OTP request/cooldown → verify → session/profile completion as needed.

### Staff access

Sign in → session/role check → MFA gate where required → permission-protected admin pages.

### Warranty/RMA

Owned completed order → eligibility/serial evidence → claim → pending review → permitted staff transition.

### Launch control

Select release reference/environment → inspect automatic blockers → record evidence-backed operator gates.

## Source of truth

- `elitedom-store/frontend/src/app/`
- `elitedom-store/backend/app/modules/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
