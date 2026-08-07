---
title: "User Stories"
status: reference
owner: product
document_type: user-stories
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "User Stories scope or referenced implementation sources change."
---

# User Stories

## Purpose

Provides outcome-oriented stories used to reason about acceptance coverage; stories do not override API/business rules.

## Reference

### Customer

As a customer, I can browse and purchase in my preferred language/theme and keep my cart across identity transitions.

### Phone user

As a phone-first customer, I can authenticate through bounded OTP flows without exposing raw verification secrets.

### Returning customer

As a returning customer, I can manage addresses, orders and service requests under object-level authorization.

### Staff user

As staff, I see only operations allowed by backend permissions and complete MFA where required.

### Commerce operator

As an operator, I can reconcile payments/refunds/fulfillment without accepting duplicated external events.

### Catalog operator

As authorized staff, I can publish content and media while preserving validation and storage safety.

### Release operator

As an operator, I can prove launch readiness for a specific release/environment with auditable evidence.

## Source of truth

- `docs/product/requirements/USE_CASES.md`
- `docs/engineering/testing/UAT.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
