---
title: "Disaster Recovery Testing"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Disaster Recovery Testing behavior, evidence, or source-of-truth changes."
---

# Disaster Recovery Testing

## Purpose

Defines recovery exercises required to turn backup/recovery plans into evidence.

## Current state

DR testing is release/environment operational evidence and should be repeated after material topology, database, backup or provider-callback changes.

## Invariants and controls

- Restore application DB and Odoo DB into controlled targets.
- Validate migrations/readiness and representative commerce records after restore.
- Validate media availability/recovery where object/local storage is in scope.
- Measure recovery point and recovery time instead of asserting planned values.
- Document discrepancies and corrective actions.

## Source of truth

- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Store evidence references in launch/release records without committing sensitive backup artifacts.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
