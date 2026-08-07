---
title: "Restore Procedures"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Restore Procedures behavior, evidence, or source-of-truth changes."
---

# Restore Procedures

## Purpose

Defines safe database restoration procedure and post-restore validation.

## Current state

`restore.sh` requires an explicit target (`app` or `odoo`). Restoration is destructive to the target database and therefore must be executed only with environment/backup identity confirmed.

## Invariants and controls

- Confirm target environment/database and isolate writes before restore.
- Validate backup provenance/integrity and retain the pre-restore state where possible.
- Restore the selected database; apply application migrations only where appropriate.
- Restart/verify readiness and key domain records.
- Reconcile Odoo/payment/provider events that occurred after the recovery point.
- Run external smoke before reopening traffic.

## Source of truth

- `elitedom-store/infrastructure/scripts/restore.sh`
- `elitedom-store/scripts/live_smoke.py`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Execute in a safe drill environment and record measured restore time/data checks.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
