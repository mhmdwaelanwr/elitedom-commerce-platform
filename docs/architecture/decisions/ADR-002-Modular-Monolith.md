---
title: "ADR-002 — Modular Monolith Application"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-002 — Modular Monolith Application

## Status

Accepted

## Context

The commerce domain has multiple bounded capabilities but does not currently justify the operational cost of independently deployed microservices.

## Decision

Keep the FastAPI business application as a modular monolith with explicit domain modules, external adapters and one application PostgreSQL database.

## Consequences

- Module ownership must remain explicit.
- Independent services may be extracted only when scale/team/reliability evidence justifies it.
- Shared database transactions remain possible inside the application boundary.

## Implementation evidence

- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/main.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
