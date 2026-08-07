---
title: "Data Classification"
status: reference
owner: operations
document_type: data-governance-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Data Classification scope or referenced implementation sources change."
---

# Data Classification

## Purpose

Defines practical sensitivity levels used for engineering and operations.

## Reference

### Public

Published catalogue/marketing content intentionally exposed without authentication.

### Internal

Non-sensitive operational/configuration metadata not intended for public disclosure.

### Confidential

Customer/contact/order/support data and business/supplier information requiring authorized access.

### Restricted

Passwords/hashes, session/token material, MFA/OTP secrets, provider/database secrets, private keys and highly sensitive security data.

## Source of truth

- `docs/operations/data-governance/PII_HANDLING.md`
- `docs/operations/infrastructure/SECRETS.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
