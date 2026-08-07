---
title: "Environment Model"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Environment Model behavior, evidence, or source-of-truth changes."
---

# Environment Model

## Purpose

Defines the behavioral differences between development, staging and production.

## Current state

`ENVIRONMENT` accepts `development`, `staging`, or `production`. Development permits local conveniences; staging/production activate fail-closed safety validation.

## Invariants and controls

- Development may use debug, in-memory rate limiting and local media depending on config.
- Staging/production require `DEBUG=false`, strong distinct secrets, staff MFA and Redis rate limiting.
- Wildcard hosts/CORS are rejected outside development.
- Enabled integrations must satisfy their secure configuration contracts.
- S3/CDN URLs must be HTTPS outside development.
- Production provider/live acceptance must be performed per environment; staging credentials do not prove production readiness.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/.env.example`
- `elitedom-store/infrastructure/docker-compose.prod.yml`

## Verification

Instantiate configuration in each environment and run readiness/smoke plus launch gates.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
