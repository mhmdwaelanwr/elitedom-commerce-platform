---
title: "Local Development"
status: current
owner: engineering
document_type: development
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Local Development behavior, evidence, or source-of-truth changes."
---

# Local Development

## Purpose

Documents the supported local bootstrap path and the difference between development defaults and production controls.

## Current state

Local development uses `.env.example`, Docker Compose development overlay, FastAPI/Odoo/PostgreSQL/Redis services and the React 19 + TypeScript + Vite frontend. Provider integrations can remain disabled where external accounts are not required.

The browser frontend keeps port `3000` for compatibility with the existing CORS and local infrastructure contract. Client-visible configuration uses `VITE_*` variables.

## Invariants and controls

- Copy `.env.example` to untracked `.env`; never commit the result.
- Use separate Odoo/application databases as configured.
- Run migrations before relying on new schema.
- Development may use memory rate limiting and local media; production cannot infer safety from those defaults.
- Use safe local seed/admin bootstrap paths; no default production admin password exists.
- Do not place provider secrets in `VITE_*` variables; those values are compiled into the browser bundle.

## Source of truth

- `elitedom-store/README.md`
- `elitedom-store/frontend/README.md`
- `elitedom-store/SETUP_AND_ENV_GUIDE.md`
- `elitedom-store/Makefile`
- `elitedom-store/infrastructure/docker-compose.dev.yml`

## Verification

Follow quick-start commands, run the frontend lint/type/build gates, and run local hygiene/documentation validation before pushing.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
