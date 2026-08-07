---
title: "Solution Architecture"
status: current
owner: architecture
document_type: architecture
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Solution Architecture behavior, evidence, or source-of-truth changes."
---

# Solution Architecture

## Purpose

Describes the current end-to-end platform architecture and the responsibility of each major runtime boundary.

## Current state

Customers and staff use a Next.js application that calls a versioned FastAPI API. FastAPI owns web-facing business rules and an application PostgreSQL database, uses Redis/Celery for asynchronous work, integrates with Paymob and optional communication/search providers, and exchanges signed/idempotent events with Odoo 17. Odoo uses a separate database and bundled connector addon.

## Invariants and controls

- FastAPI and Odoo databases are distinct; cross-system consistency is handled through API/webhook/outbox mechanisms rather than cross-database transactions.
- Frontend is a presentation/client boundary and does not receive private provider secrets.
- Paymob callback state is verified server-side; legacy Stripe routes remain isolated compatibility code.
- Odoo connector messages are signed and processed idempotently.
- Production media uses S3-compatible object storage/CDN when configured; local media is a development/single-node mode.
- Staging/production require Redis rate limiting and staff MFA by configuration.

## Logical flow

1. Browser renders storefront/admin and calls `/api/v1`.
2. FastAPI authenticates/authorizes, validates domain commands and persists application state.
3. Transactional events enqueue asynchronous/provider work where consistency requires post-commit delivery.
4. Celery workers call optional providers or retry outbox deliveries.
5. Odoo and Paymob callbacks enter dedicated verified webhook boundaries.
6. Health/readiness and observability expose operational state without leaking secrets.

## Source of truth

- `elitedom-store/backend/app/main.py`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/frontend/`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Verification

Validate Compose, backend/frontend CI, Odoo clean install/tests and launch acceptance. Environment topology must be compared with the deployment manifests.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
