---
title: "Data Retention Policy"
status: current
owner: operations
document_type: data-governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Data Retention Policy behavior, evidence, or source-of-truth changes."
---

# Data Retention Policy

## Purpose

Defines retention decision rules without inventing legal periods that have not been approved for the operating entity.

## Current state

Retention periods are a business/legal/operational decision and must be configured/documented per deployment. Technical records such as audit, webhook receipts, outbox/dead-letter, auth sessions and backups have distinct purposes.

## Invariants and controls

- Do not declare statutory retention durations without legal/finance approval for the operating jurisdiction/entity.
- Retain financial/order/audit evidence according to approved obligations and dispute requirements.
- Expire authentication/session/OTP data according to security semantics, not indefinite retention.
- Bound retry/outbox/provider receipt retention where safe and operationally supported.
- Backups inherit retention/deletion/security obligations and need separate lifecycle policy.

## Source of truth

- `elitedom-store/backend/app/modules/`
- `elitedom-store/odoo/addons/elitedom_connector/`
- `docs/operations/disaster-recovery/BACKUP_STRATEGY.md`

## Verification

Approve a production retention schedule and verify implemented cleanup/provider policies before asserting compliance.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
