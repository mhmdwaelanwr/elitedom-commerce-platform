---
title: "Backup and Recovery Runbook"
status: current
owner: operations
document_type: runbook
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Backup and Recovery Runbook behavior, evidence, or source-of-truth changes."
---

# Backup and Recovery Runbook

## Purpose

Defines backup/restore execution rules for application and Odoo data.

## Current state

Repository scripts support database backup/restore for application and Odoo targets. Production backup location, encryption, retention and media/object-storage protection depend on the deployment and must be documented operationally.

## Invariants and controls

- Back up application and Odoo databases with explicit identity/date/release context.
- Protect backup credentials/files from source control and public storage.
- Test restore into a safe isolated target before claiming recovery readiness.
- After restore, run migrations as appropriate and verify readiness plus key domain counts/state.
- Reconcile media/object storage and external provider/ERP state where point-in-time boundaries differ.

## Source of truth

- `elitedom-store/infrastructure/scripts/backup.sh`
- `elitedom-store/infrastructure/scripts/restore.sh`
- `docs/operations/disaster-recovery/`

## Verification

Perform a release/environment-scoped restore drill and record evidence in launch acceptance.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
