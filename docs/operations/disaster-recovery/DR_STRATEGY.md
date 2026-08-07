---
title: "Disaster Recovery Strategy"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Disaster Recovery Strategy behavior, evidence, or source-of-truth changes."
---

# Disaster Recovery Strategy

## Purpose

Defines recovery strategy for loss of host, database, application release or critical dependency.

## Current state

The repository provides portable container topology and database backup/restore tooling. Actual multi-region failover, off-site backup storage and infrastructure replacement depend on the chosen hosting environment and must not be assumed to exist.

## Invariants and controls

- Prioritize preservation/recovery of application DB, Odoo DB, media/object data and secrets/config references.
- Use immutable release artifacts/refs to rebuild application containers.
- Keep backup copies outside the failure domain they protect.
- Restore into isolated targets for drills; reconcile provider/ERP events after point-in-time recovery.
- Treat DNS/TLS/provider reconfiguration as part of recovery where host endpoints change.

## Source of truth

- `elitedom-store/infrastructure/`
- `docs/operations/runbooks/BACKUP_RECOVERY.md`

## Verification

Perform documented staging recovery drills and record measured outcomes.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
