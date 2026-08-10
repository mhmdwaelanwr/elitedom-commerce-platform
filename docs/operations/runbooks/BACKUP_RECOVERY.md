---
title: "Backup and Recovery Runbook"
status: current
owner: operations
document_type: runbook
verified_against: "P24 isolated restore-drill implementation"
review_trigger: "Backup creation, isolated restore testing, destructive recovery, or evidence requirements change."
---

# Backup and Recovery Runbook

## Purpose

Defines backup/restore execution rules for application and Odoo data.

## Current state

Repository tooling supports three distinct operations: deployment-time pre-migration dumps, an isolated non-destructive restore drill, and an explicit destructive recovery helper. Production backup location, encryption, retention and media/object-storage protection remain environment-specific.

## Normal readiness procedure

1. Identify application and Odoo backups for the same environment/recovery context.
2. Validate and restore both with `restore_drill.sh` into its disposable PostgreSQL target.
3. Require successful SQL materialization and non-zero user-table validation for both databases.
4. Capture backup identifiers, elapsed time and discrepancies without publishing backup contents.
5. Validate media/object-storage and provider/ERP reconciliation separately.

The isolated drill is the default readiness path. It never joins the live Compose project or uses the live `.env`.

## Destructive recovery

`restore.sh` remains an incident/recovery tool. Do not call it merely to satisfy a launch drill. A destructive restore requires explicit target/environment confirmation, write isolation and compatibility/reconciliation assessment.

## Invariants and controls

- Back up application and Odoo databases with explicit identity/date/release context.
- Protect backup credentials/files from source control and public storage.
- Test restore into a safe isolated target before claiming recovery readiness.
- Never use `docker compose down -v` as part of deployment or routine recovery testing.
- After an approved destructive restore, run migrations/upgrades only where appropriate and verify readiness plus representative domain state.
- Reconcile media/object storage and external provider/ERP state where point-in-time boundaries differ.
- Repeat production recovery evidence in production; staging evidence is not transferable.

## Source of truth

- `elitedom-store/infrastructure/scripts/backup.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/infrastructure/scripts/restore.sh`
- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`
- `docs/operations/disaster-recovery/DR_TESTING.md`

## Verification

Perform a release/environment-scoped isolated restore drill and reference non-secret measured evidence in launch acceptance. Use the destructive path only as part of an explicitly approved recovery exercise or incident.

## Change policy

Update this document in the same pull request as changes to backup generation, restore isolation, destructive recovery or recovery evidence requirements.
