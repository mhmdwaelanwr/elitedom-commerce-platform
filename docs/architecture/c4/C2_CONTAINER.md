---
title: "C4 Level 2 — Containers"
status: current
owner: architecture
document_type: c4
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "C4 Level 2 — Containers behavior, evidence, or source-of-truth changes."
---

# C4 Level 2 — Containers

## Purpose

Documents runtime containers/services and their responsibilities.

## Current state

The default Compose topology runs PostgreSQL, an app-database initializer, Odoo, Redis, FastAPI, a React/Vite frontend served as static assets by unprivileged Nginx, Celery worker, Celery beat, Nginx Proxy Manager and Portainer on the `elitedom-net` network. FastAPI and Odoo share the PostgreSQL server process but use distinct databases.

## Invariants and controls

- Frontend is bound to host loopback in Compose; public ingress is expected through the proxy/TLS layer.
- FastAPI and workers load runtime environment configuration; frontend `VITE_*` public values are compiled into the static bundle at build time.
- React Router deep links are handled by the frontend Nginx history fallback to `index.html`.
- Redis backs Celery and production rate limiting.
- Named volumes persist PostgreSQL, Odoo, Redis, media and operations-tool state.
- Readiness/liveness belongs to the application; Compose health checks support orchestration.

## Source of truth

- `elitedom-store/frontend/Dockerfile`
- `elitedom-store/frontend/nginx.conf`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`

## Verification

Run Docker Compose config validation for development and production overlays, and verify the frontend image serves `/` plus a React Router deep link through the SPA fallback.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
