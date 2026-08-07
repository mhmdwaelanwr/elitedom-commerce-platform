---
title: "ADR-005 — Oracle Cloud VPS Hosting"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted with deployment-specific scope
---

# ADR-005 — Oracle Cloud VPS Hosting

## Status

Accepted with deployment-specific scope

## Context

The initial hosting plan selected an Oracle Cloud VPS. Hosting is an operational choice that does not define application semantics.

## Decision

Retain Oracle Cloud VPS as the documented deployment target where used, but keep runtime containers and configuration portable. Do not bake cloud-specific credentials or private addresses into application code.

## Consequences

- Compose remains the portable deployment contract.
- Cloud networking, DNS, TLS, backups and host hardening require environment-specific evidence.
- A hosting migration does not require rewriting business/domain architecture.

## Implementation evidence

- `elitedom-store/infrastructure/`
- `docs/operations/infrastructure/`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
