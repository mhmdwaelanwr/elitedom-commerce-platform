---
title: "Backup Strategy"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Backup Strategy behavior, evidence, or source-of-truth changes."
---

# Backup Strategy

## Purpose

Defines what must be backed up and how backup quality is demonstrated.

## Current state

Database backup scripts cover application and Odoo databases. Media/object data, proxy/operations-tool configuration and off-site retention are deployment-specific and require explicit production policy.

## Invariants and controls

- Back up both databases independently with identifiable timestamps/environment.
- Encrypt/protect backup storage and credentials.
- Use retention/rotation appropriate to approved RPO and legal requirements.
- Back up media/object storage or use provider versioning/replication appropriate to risk.
- Verify backups by restore, not file existence alone.

## Source of truth

- `elitedom-store/infrastructure/scripts/backup.sh`
- `docs/operations/runbooks/BACKUP_RECOVERY.md`

## Verification

Run restore drills and capture recovery point/time and integrity checks.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
