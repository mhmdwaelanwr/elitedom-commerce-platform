---
title: "C4 Deployment View"
status: current
owner: architecture
document_type: c4
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "C4 Deployment View behavior, evidence, or source-of-truth changes."
---

# C4 Deployment View

## Purpose

Documents the supported repository deployment shape and its security/operational assumptions.

## Current state

Deployment is containerized with Compose overlays. Production overrides force production environment semantics for FastAPI and workers, require public frontend site/API URLs, require staff MFA and Redis rate limiting, and rely on external environment secret provisioning. Nginx Proxy Manager is the included ingress/TLS management component.

## Invariants and controls

- Public HTTPS/TLS/domain configuration is deployment evidence, not stored as a secret-bearing repository file.
- Administrative tooling must remain bound/restricted appropriately; default admin bind values favor loopback.
- Production object-media deployments should use S3/CDN configuration rather than assuming a local volume is horizontally scalable.
- Backups, restore drills and rollback readiness are required before launch.

## Source of truth

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/infrastructure/scripts/`

## Verification

Validate Compose and execute staging smoke/backup/restore checks against the exact release reference.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
