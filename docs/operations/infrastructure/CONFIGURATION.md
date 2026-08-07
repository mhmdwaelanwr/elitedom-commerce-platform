---
title: "Configuration Reference"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Configuration Reference behavior, evidence, or source-of-truth changes."
---

# Configuration Reference

## Purpose

Defines configuration ownership and important safety categories. `.env.example` and `Settings` are authoritative for exact keys/defaults.

## Current state

Backend settings cover environment/security, PostgreSQL, Redis/Celery, auth/OAuth, Odoo, legacy Stripe, Paymob, Algolia, Twilio, email providers, Zoho scaffold, Hedera fail-closed scaffold, media/S3, metrics and OpenTelemetry. Frontend public settings are explicitly build/public values.

## Invariants and controls

- Do not duplicate secret values in docs.
- Treat `NEXT_PUBLIC_*` values as browser-visible by design; never place private credentials in them.
- Only enabled providers should require production credentials, except core database/Redis/security settings.
- Configuration validation rejects unsafe production combinations before service startup.
- Changing configuration names/defaults requires `.env.example`, docs and deployment review.

## Source of truth

- `elitedom-store/.env.example`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/infrastructure/`

## Verification

Run config unit tests, Compose validation and production launch automatic gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
