---
title: "Go-Live Checklist"
status: reference
owner: operations
document_type: runbook-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Go-Live Checklist scope or referenced implementation sources change."
---

# Go-Live Checklist

## Purpose

Provides a compact operator checklist; the full procedure is `GO_LIVE_RUNBOOK.md`.

## Reference

### Repository

Immutable release ref; CI six jobs green; repository/documentation hygiene green.

### Configuration

Production mode, debug off, strong distinct secrets, hosts/CORS, staff MFA, Redis rate limiting, protected metrics.

### Data

Migration graph reviewed; backup and restore drill evidence; rollback implications known.

### Providers

Paymob/Odoo/OAuth/Twilio/email/search/media providers configured only when enabled; HTTPS callbacks/domains proven.

### UX/UAT

EN/AR, RTL/LTR, themes, responsive/accessibility, auth, catalogue/cart/checkout/payment/refund/fulfillment/service/admin.

### Operations

Readiness, external smoke, monitoring/alerts, worker/outbox health, incident/rollback owner.

### Approval

Launch control plane has evidence for the exact release reference and environment.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `elitedom-store/backend/app/modules/admin/launch_service.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
