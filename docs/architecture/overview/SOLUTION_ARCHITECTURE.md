---
title: "Solution Architecture"
status: current
owner: architecture
document_type: architecture
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Solution Architecture behavior, evidence, or source-of-truth changes."
---

# Solution Architecture

## Purpose

Describes the current end-to-end platform architecture and the responsibility of each major runtime boundary.

## Current state

Customers and staff use a React 19 + TypeScript + Vite single-page application with React Router. The production frontend is built to static assets and served by unprivileged Nginx with SPA history fallback. The browser calls a versioned FastAPI API. FastAPI owns web-facing business rules and an application PostgreSQL database, uses Redis/Celery for asynchronous work, integrates with Paymob and optional communication/search providers, and exchanges signed/idempotent events with Odoo 17. Odoo uses a separate database and bundled connector addon.

## Invariants and controls

- FastAPI and Odoo databases are distinct; cross-system consistency is handled through API/webhook/outbox mechanisms rather than cross-database transactions.
- Frontend is a presentation/client boundary and does not receive private provider secrets; `VITE_*` values are public build-time configuration only.
- Client-side routing does not grant authority: authentication, permissions, money, stock, payment and order transitions remain server-authoritative.
- Paymob callback state is verified server-side; legacy Stripe routes remain isolated compatibility code.
- Odoo connector messages are signed and processed idempotently.
- Production media uses S3-compatible object storage/CDN when configured; local media is a development/single-node mode.
- Staging/production require Redis rate limiting and staff MFA by configuration.

## Logical flow

1. Browser loads the static React application and resolves routes client-side through React Router.
2. Browser calls `/api/v1` for authenticated and commerce operations.
3. FastAPI authenticates/authorizes, validates domain commands and persists application state.
4. Transactional events enqueue asynchronous/provider work where consistency requires post-commit delivery.
5. Celery workers call optional providers or retry outbox deliveries.
6. Odoo and Paymob callbacks enter dedicated verified webhook boundaries.
7. Health/readiness and observability expose operational state without leaking secrets.

## Source of truth

- `elitedom-store/frontend/src/main.tsx`
- `elitedom-store/frontend/src/router.tsx`
- `elitedom-store/frontend/vite.config.ts`
- `elitedom-store/frontend/nginx.conf`
- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Verification

Validate Compose, backend/frontend CI, Vite production build, React Router deep-link serving, Odoo clean install/tests and launch acceptance. Environment topology must be compared with the deployment manifests.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
