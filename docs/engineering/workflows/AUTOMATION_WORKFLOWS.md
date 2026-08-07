---
title: "Automation Workflows"
status: current
owner: engineering
document_type: domain-rules
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Automation Workflows behavior, evidence, or source-of-truth changes."
---

# Automation Workflows

## Purpose

Documents automated repository and runtime workflows without treating automation as a substitute for operator judgment.

## Current state

GitHub Actions covers application CI, repository/documentation hygiene and manually dispatched external launch smoke. Runtime Celery handles scheduled/asynchronous integration work. Odoo has its own cron/outbox behavior inside the connector.

## Invariants and controls

- CI is deterministic and uses placeholder/non-production credentials.
- Repository/documentation hygiene runs without depending on provider accounts.
- Launch smoke only targets public HTTPS destinations and fails closed on private/redirected targets.
- Worker retries must preserve idempotency and not create duplicate commerce effects.
- Scheduled cleanup/retry jobs require bounded retention/attempt policies.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/repository-hygiene.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/backend/app/celery_app.py`
- `elitedom-store/odoo/addons/elitedom_connector/`

## Verification

Inspect workflow runs plus runtime task tests; manual production smoke results remain release evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
