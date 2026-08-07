---
title: "ADR-004 — Containerized Deployment"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-004 — Containerized Deployment

## Status

Accepted

## Context

Development and deployment require reproducible service topology across application, ERP, database, cache/workers and ingress tooling.

## Decision

Use Docker images and Docker Compose overlays as the repository deployment contract.

## Consequences

- Compose config is CI-validated.
- Production secrets remain external to images/source.
- Container hardening is applied where supported, but host/network security is still an operator responsibility.

## Implementation evidence

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
