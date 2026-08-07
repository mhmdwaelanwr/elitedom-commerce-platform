---
title: "Non-Functional Requirements"
status: current
owner: product
document_type: requirements
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Non-Functional Requirements behavior, evidence, or source-of-truth changes."
---

# Non-Functional Requirements

## Purpose

Defines measurable engineering qualities required of the platform. Numeric production SLOs remain targets until backed by measured operational evidence.

## Current state

The repository enforces several NFRs directly: production configuration fails closed, staff MFA/Redis rate limiting are required outside development, migrations replay in CI, frontend builds in CI, Odoo installs cleanly, and launch assets are validated.

## Invariants and controls

- Security: strong environment secrets, backend authorization, staff MFA, webhook verification, no wildcard production hosts/CORS.
- Reliability: idempotent integrations, explicit state transitions, migration replay, readiness checks and transactional outbox patterns.
- Maintainability: modular backend domains, typed frontend, documented ownership and CI-enforced repository/documentation hygiene.
- Internationalization: EN/AR, LTR/RTL and locale-aware presentation.
- Performance: bounded provider/readiness timeouts, distributed production rate limiting, image optimization and cache-safe sensitive endpoints.
- Recoverability: backup/restore, rollback and release evidence are launch requirements.
- Accessibility: keyboard/focus/responsive states are UAT obligations and should be tested with the exact release candidate.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `.github/workflows/ci.yml`
- `elitedom-store/frontend/`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

CI proves repository gates; performance/accessibility/recovery targets require environment-specific test evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
