---
title: "Restore Procedures"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "P24 isolated restore-drill implementation"
review_trigger: "Restore target isolation, database backup format, destructive recovery procedure, or validation evidence changes."
---

# Restore Procedures

## Purpose

Defines safe database restoration for both non-destructive recovery drills and explicit destructive recovery.

## Current state

Two different restore paths exist and must not be confused:

- `restore_drill.sh` is the normal launch-readiness exercise. It restores application and Odoo backups into an isolated disposable PostgreSQL container and never touches live Compose databases or volumes.
- `restore.sh` is an explicit destructive recovery helper for a selected live target (`app` or `odoo`). It is not called by deployment automation or the restore drill.

## Isolated restore drill

Run the drill with one application backup and one Odoo backup:

```bash
elitedom-store/infrastructure/scripts/restore_drill.sh \
  /path/to/elitedom_TIMESTAMP_app.sql.gz \
  /path/to/elitedom_TIMESTAMP_odoo.sql.gz
```

The drill:

- requires regular non-symlink backup files;
- runs `gzip -t` on both inputs before restoring;
- creates a unique disposable Docker volume;
- starts a PostgreSQL 15 container with `--network none` and no published ports;
- restores into separate `elitedom_restore_drill_app` and `elitedom_restore_drill_odoo` databases;
- uses `ON_ERROR_STOP` and requires both restored databases to contain user tables;
- removes only its own disposable container and volume on exit;
- does not read `.env`, mount the live database volume, join the live Compose network, or invoke `restore.sh`.

A passing drill proves the selected SQL dumps can be materialized into PostgreSQL and queried. Application/Odoo functional validation, provider reconciliation and measured recovery objectives remain environment evidence rather than assumptions.

## Destructive recovery path

Use `restore.sh` only after an incident decision identifies a specific recovery target. Before executing it:

- confirm the exact environment, database and backup identity;
- stop or isolate application writes as required by the incident plan;
- preserve current state when feasible;
- confirm schema/application/Odoo compatibility;
- document reconciliation requirements for provider and ERP events after the recovery point.

After destructive recovery, run migrations or Odoo upgrade only where appropriate, restore service readiness, validate representative commerce state and run the public smoke before reopening traffic.

## Invariants and controls

- Routine deployment never performs automatic restore or database downgrade.
- A successful backup file is not sufficient recovery evidence without a restore exercise.
- Staging restore-drill evidence cannot be reused as production recovery evidence.
- Never use `docker compose down -v` as a recovery or deployment step.
- Backup files and restored data may contain sensitive business/customer information and must not be committed or uploaded to public artifacts.

## Source of truth

- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/infrastructure/scripts/restore.sh`
- `elitedom-store/infrastructure/scripts/backup.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Execute `restore_drill.sh` against release/environment-scoped application and Odoo backups, retain non-secret evidence of the backup identifiers, timestamp, table validation and measured duration, then record any discrepancies or corrective action in the launch evidence.

## Change policy

Update this document in the same pull request as any change to backup format, restore isolation, destructive recovery behavior or recovery acceptance evidence.
