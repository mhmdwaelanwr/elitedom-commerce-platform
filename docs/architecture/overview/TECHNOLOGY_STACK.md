---
title: "Technology Stack"
status: reference
owner: architecture
document_type: technology-reference
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Technology Stack scope or referenced implementation sources change."
---

# Technology Stack

## Purpose

Records the currently selected runtime technologies and their architectural role; package manifests and container tags are authoritative for exact versions.

## Reference

### Web

React 19.2, TypeScript 5, Vite 7, React Router 7 and Tailwind CSS 4. The browser application is a client-side SPA; production assets are served by unprivileged Nginx with history fallback.

### API

Python 3.11, FastAPI, Pydantic, SQLAlchemy async, Alembic.

### Application data

PostgreSQL 15; separate application and Odoo databases.

### ERP

Odoo 17 Community with `elitedom_connector` 17.0.2.0.0.

### Async/cache

Redis 7 and Celery worker/beat.

### Payments

Paymob current primary integration; Stripe legacy compatibility remains in code/migration history.

### Media

Local filesystem mode or S3-compatible object storage with explicit CDN URL. Product-media sizing, transformation and CDN optimization are application/storage concerns rather than framework-specific image optimization.

### Observability

Structured request context, Prometheus-compatible metrics, optional OpenTelemetry export.

### Deployment

Docker Compose base + environment overlays; static React/Vite frontend served by Nginx; Nginx Proxy Manager and Portainer included in topology.

## Source of truth

- `elitedom-store/frontend/package.json`
- `elitedom-store/frontend/vite.config.ts`
- `elitedom-store/frontend/nginx.conf`
- `elitedom-store/backend/requirements.txt`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/odoo/addons/elitedom_connector/__manifest__.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
