---
title: "Glossary"
status: reference
owner: product
document_type: glossary
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Glossary scope or referenced implementation sources change."
---

# Glossary

## Purpose

Standardizes business and engineering terms used across Elitedom documentation.

## Reference

### Application database

The PostgreSQL database used by FastAPI (`APP_POSTGRES_DB`), deliberately distinct from the Odoo database.

### ERP

Odoo 17 Community and the bundled `elitedom_connector` addon.

### Launch gate

Automatic or operator-approved condition required before a release/environment can be considered ready.

### Release reference

Immutable commit SHA/tag associated with launch evidence. Evidence must not carry between release references.

### Payment attempt

Provider-specific payment initiation/result record tied to an order and state transitions.

### Webhook receipt

Persisted/idempotent handling record used to prevent duplicate provider events from applying effects more than once.

### Outbox

Transactional event record used to deliver cross-system work asynchronously after database commit.

### Staff MFA

TOTP/recovery-code second factor required by configuration in staging/production.

### Living document

Documentation marked current/operational and maintained with implementation.

### Historical record

Immutable delivery evidence retained for context but not used as a current runtime contract.

## Source of truth

- `elitedom-store/backend/app/`
- `docs/governance/STATUS_MODEL.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
