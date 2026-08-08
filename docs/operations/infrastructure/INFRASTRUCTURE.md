---
title: "Infrastructure Overview"
status: current
owner: operations
document_type: operations
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Infrastructure Overview behavior, evidence, or source-of-truth changes."
---

# Infrastructure Overview

## Purpose

Defines the supported infrastructure topology and ownership boundaries.

## Current state

Repository deployment uses Docker Compose with PostgreSQL, Odoo, Redis, FastAPI, a React/Vite static frontend served by unprivileged Nginx, Celery worker/beat, Nginx Proxy Manager and Portainer. Cloud/host networking, DNS, TLS certificates, secret storage and backup destinations are environment-owned and are not hard-coded.

## Invariants and controls

- Use distinct Odoo/application databases.
- Expose customer traffic through a controlled HTTPS ingress; internal service names are not browser URLs.
- Build the frontend with browser-reachable public `VITE_*` URLs; private service credentials never enter the static bundle.
- React Router deep links depend on Nginx SPA fallback to `index.html`.
- Administrative interfaces must be restricted by bind/network/firewall policy.
- Production media should use object storage/CDN when horizontal durability/scaling is required.
- Host patching, disk capacity and external backup destination are operator responsibilities.

## Source of truth

- `elitedom-store/frontend/Dockerfile`
- `elitedom-store/frontend/nginx.conf`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`

## Verification

Run Compose validation and environment-specific staging deployment/smoke checks. Verify both `/` and a non-root client route resolve through the production frontend container.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
