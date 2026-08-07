---
title: "ADR-005 — Oracle Cloud VPS Hosting"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The deployment platform, portability requirement, or infrastructure ownership model materially changes."
decision_status: Accepted
---

# ADR-005 — Oracle Cloud VPS Hosting

## Status

Accepted — deployment-specific scope.

## Context

The initial deployment plan selected an Oracle Cloud VPS. Hosting location is an operational decision rather than a domain/application semantic, so the platform must remain deployable without embedding cloud-specific credentials, private addresses, or proprietary runtime assumptions into application code.

## Decision

Use Oracle Cloud VPS as the documented deployment target where that environment is operated, while treating containerized runtime contracts, configuration, data/recovery procedures, and public DNS/TLS as portable concerns. The application must not require Oracle-specific SDKs or infrastructure identity merely to start.

## Consequences

- Docker Compose and container images remain the primary portable runtime contract for the current deployment model.
- Cloud networking, firewalling, DNS, TLS termination, storage, backup destinations, monitoring, and host hardening are environment responsibilities and require deployment evidence.
- A future hosting migration can replace the VPS/cloud platform without rewriting business/domain architecture.
- Production readiness is not implied by naming a cloud provider; backup/restore, security, capacity, observability, and rollback still require acceptance.

## Implementation evidence

- `elitedom-store/infrastructure/`
- `docs/operations/infrastructure/`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Review rule

If the project adopts a materially different hosting/deployment model that changes runtime architecture (for example managed orchestration rather than the current Compose/VPS model), supersede this ADR with a new decision. Do not silently rewrite its historical rationale.
