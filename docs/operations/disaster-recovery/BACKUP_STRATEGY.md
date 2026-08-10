---
title: "Backup Strategy"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "P24 isolated restore-drill implementation"
review_trigger: "Backup creation, retention, restore-drill behavior, or source-of-truth changes."
---

# Backup Strategy

## Purpose

Defines what must be backed up and how backup quality is demonstrated.

## Current state

Deployment and backup tooling cover the application and Odoo PostgreSQL databases. P24 adds an isolated restore drill that proves selected SQL dumps can be materialized without targeting the live Compose databases or volumes. Media/object data, reverse-proxy/operations-tool configuration and off-site retention remain environment-specific policies.

## Invariants and controls

- Back up application and Odoo databases independently with identifiable timestamps/environment/release context.
- Deployment-time backups are written outside the Git checkout and gzip-validated before migrations/upgrades.
- Protect backup storage and credentials from source control and public artifacts.
- Use retention/rotation appropriate to the approved recovery policy and legal requirements.
- Back up media/object storage or use provider versioning/replication appropriate to risk.
- Verify backups by restore, not file existence or gzip integrity alone.
- Run routine readiness restores only against isolated drill targets; destructive live restore requires a separate incident decision.
- Staging recovery evidence does not prove production recoverability.

## Source of truth

- `elitedom-store/infrastructure/scripts/backup.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `docs/operations/runbooks/BACKUP_RECOVERY.md`
- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`

## Verification

Run the isolated application/Odoo restore drill, capture backup identifiers plus measured timing/integrity evidence, and record media/provider recovery gaps separately.

## Change policy

Update this document in the same pull request as any change to backup creation, retention, restore verification or recovery evidence requirements.
