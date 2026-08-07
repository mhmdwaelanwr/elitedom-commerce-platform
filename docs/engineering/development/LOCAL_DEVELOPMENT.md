---
title: "Local Development"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Local Development behavior, evidence, or source-of-truth changes."
---

# Local Development

## Purpose

Documents the supported local bootstrap path and the difference between development defaults and production controls.

## Current state

Local development uses `.env.example`, Docker Compose development overlay, FastAPI/Odoo/PostgreSQL/Redis services and the Next.js application. Provider integrations can remain disabled where external accounts are not required.

## Invariants and controls

- Copy `.env.example` to untracked `.env`; never commit the result.
- Use separate Odoo/application databases as configured.
- Run migrations before relying on new schema.
- Development may use memory rate limiting and local media; production cannot infer safety from those defaults.
- Use safe local seed/admin bootstrap paths; no default production admin password exists.

## Source of truth

- `elitedom-store/README.md`
- `elitedom-store/SETUP_AND_ENV_GUIDE.md`
- `elitedom-store/Makefile`
- `elitedom-store/infrastructure/docker-compose.dev.yml`

## Verification

Follow quick-start commands and run local hygiene/documentation validation before pushing.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
