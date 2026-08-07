---
title: "ADR-009 — Backup and Restore Strategy"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-009 — Backup and Restore Strategy

## Status

Accepted

## Context

Application and ERP data must be recoverable independently and restore procedures must be proven rather than assumed.

## Decision

Use database backups for both application and Odoo stores, retain recovery procedures, and make restore evidence a launch gate. Media/object storage requires corresponding backup/versioning policy at the chosen provider.

## Consequences

- A backup without a successful restore drill is not release evidence.
- Recovery scope includes credentials/config dependencies and media where applicable.
- RPO/RTO values remain targets until approved/measured.

## Implementation evidence

- `elitedom-store/infrastructure/scripts/backup.sh`
- `elitedom-store/infrastructure/scripts/restore.sh`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
