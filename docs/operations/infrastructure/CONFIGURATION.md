---
title: "Configuration Reference"
status: current
owner: operations
document_type: operations
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Configuration Reference behavior, evidence, or source-of-truth changes."
---

# Configuration Reference

## Purpose

Defines configuration ownership and important safety categories. `.env.example` and `Settings` are authoritative for exact keys/defaults.

## Current state

Backend settings cover environment/security, PostgreSQL, Redis/Celery, auth/OAuth, Odoo, legacy Stripe, Paymob, Algolia, Twilio, email providers, Zoho scaffold, Hedera fail-closed scaffold, media/S3, metrics and OpenTelemetry. React/Vite frontend public settings are explicitly browser-visible build values.

## Invariants and controls

- Do not duplicate secret values in docs.
- Treat `VITE_*` values as browser-visible by design; never place private credentials in them.
- `VITE_API_URL` and `VITE_SITE_URL` must be browser-reachable public URLs for the target build, not internal Compose service names.
- Changing public frontend configuration requires rebuilding the static frontend image.
- Only enabled providers should require production credentials, except core database/Redis/security settings.
- Configuration validation rejects unsafe production combinations before service startup.
- Changing configuration names/defaults requires `.env.example`, docs and deployment review.

## Source of truth

- `elitedom-store/.env.example`
- `elitedom-store/frontend/src/lib/env.ts`
- `elitedom-store/frontend/Dockerfile`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/infrastructure/`

## Verification

Run config unit tests, frontend production build, Compose validation and production launch automatic gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
