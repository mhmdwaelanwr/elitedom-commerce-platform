---
title: "Infrastructure Overview"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Infrastructure Overview behavior, evidence, or source-of-truth changes."
---

# Infrastructure Overview

## Purpose

Defines the supported infrastructure topology and ownership boundaries.

## Current state

Repository deployment uses Docker Compose with PostgreSQL, Odoo, Redis, FastAPI, Next.js, Celery worker/beat, Nginx Proxy Manager and Portainer. Cloud/host networking, DNS, TLS certificates, secret storage and backup destinations are environment-owned and are not hard-coded.

## Invariants and controls

- Use distinct Odoo/application databases.
- Expose customer traffic through a controlled HTTPS ingress; internal service names are not browser URLs.
- Administrative interfaces must be restricted by bind/network/firewall policy.
- Production media should use object storage/CDN when horizontal durability/scaling is required.
- Host patching, disk capacity and external backup destination are operator responsibilities.

## Source of truth

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`

## Verification

Run Compose validation and environment-specific staging deployment/smoke checks.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
