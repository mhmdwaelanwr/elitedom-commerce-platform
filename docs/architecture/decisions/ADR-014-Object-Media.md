---
title: "ADR-014 — S3-Compatible Product Media with CDN"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-014 — S3-Compatible Product Media with CDN

## Status

Accepted

## Context

Local media volumes are convenient for development but do not provide a robust multi-node production media boundary.

## Decision

Support local media for development and S3-compatible object storage with explicit CDN base URL for production-scale deployments.

## Consequences

- Production/staging object media requires HTTPS CDN configuration.
- Uploads preserve validation and transactional cleanup semantics.
- Credential resolution follows provider/IAM environment rather than hard-coded access keys.

## Implementation evidence

- `elitedom-store/backend/app/modules/products/catalog_media.py`
- `elitedom-store/backend/app/config.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
