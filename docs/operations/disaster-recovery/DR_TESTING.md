---
title: "Disaster Recovery Testing"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "P24 isolated restore-drill implementation"
review_trigger: "DR drill tooling, topology, database backup, recovery validation, or evidence requirements change."
---

# Disaster Recovery Testing

## Purpose

Defines recovery exercises required to turn backup/recovery plans into environment-specific evidence.

## Current state

P24 provides a non-destructive database restore drill that can be run on an existing staging host without attaching to the live Compose project. DR evidence remains release/environment scoped and must be repeated after material topology, database, backup or provider-callback changes.

## Required staging drill

For a qualified staging release:

1. identify one application and one Odoo backup created for the same environment/recovery point;
2. record their identifiers and timestamps without copying backup data into Git;
3. run `restore_drill.sh` and require gzip validation, successful SQL restore and non-zero user-table validation for both databases;
4. measure elapsed restore time rather than claiming an unmeasured RTO;
5. compare the available backup point with current durable state rather than claiming an unmeasured RPO;
6. record any media/object-storage gap separately because database restore does not restore external media;
7. record provider/Odoo reconciliation steps needed for events after the recovery point.

The automated drill deliberately cannot prove live traffic failover, DNS reversal, provider replay safety or production recovery. Those remain controlled operational exercises.

## Invariants and controls

- Restore application DB and Odoo DB only into isolated drill targets during routine readiness testing.
- Never run the destructive `restore.sh` against the live staging database merely to produce drill evidence.
- Never use `docker compose down -v` during a recovery exercise.
- Validate representative commerce records/functionality after a recovery only in an isolated or explicitly approved recovery target.
- Validate media availability/recovery where object/local storage is in scope.
- Measure recovery point and recovery time instead of asserting planned values.
- Document discrepancies and corrective actions.
- Production requires production-specific recovery evidence; staging evidence is not transferable.

## Source of truth

- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`
- `docs/operations/disaster-recovery/BACKUP_STRATEGY.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Execute the isolated drill using retained staging backups, capture non-secret success/timing evidence, and reference that evidence in the launch-control record for the exact release/environment.

## Change policy

Update this document in the same pull request as any change to DR tooling, recovery targets, evidence requirements or topology assumptions.
