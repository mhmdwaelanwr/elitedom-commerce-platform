---
title: "Decision Log"
status: reference
owner: delivery
document_type: decision-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Decision Log scope or referenced implementation sources change."
---

# Decision Log

## Purpose

Provides a concise index of significant project decisions; durable architectural decisions live in ADRs.

## Reference

### ERP boundary

Odoo 17 with repository connector and separate FastAPI/Odoo databases.

### Application architecture

Modular monolith with explicit provider/integration adapters.

### Payment direction

Paymob primary; Stripe retained as superseded legacy compatibility.

### Security hardening

Staff TOTP MFA + Redis rate limiting required outside development.

### Media

S3-compatible object storage/CDN supported for production-scale media.

### Launch control

Manual/automatic gates scoped by release reference and environment.

### Documentation

Domain-based enterprise knowledge base with CI-validated truth/status model.

## Source of truth

- `docs/architecture/decisions/README.md`
- `docs/delivery/releases/`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
