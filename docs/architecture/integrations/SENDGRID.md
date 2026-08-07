---
title: "SendGrid Email Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "SendGrid Email Integration behavior, evidence, or source-of-truth changes."
---

# SendGrid Email Integration

## Purpose

Documents the SendGrid Email boundary, implementation status, security controls and operational enablement requirements.

## Current state

SendGrid has an optional asynchronous task implementation and explicit enable/key/from configuration. It is not required for core local commerce when disabled.

## Invariants and controls

- Only enable with a non-placeholder API key.
- Keep provider calls asynchronous where current task routing expects it.
- Do not include credentials or unnecessary PII in logs.
- Email delivery failure must be observable/retry-safe and must not roll back already-committed commerce state.

## Enablement and failure mode

Production enablement requires verified sender/domain/provider acceptance and test delivery; provider dashboard evidence remains environment-specific.

## Source of truth

- `elitedom-store/backend/app/integrations/sendgrid/tasks.py`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/app/celery_app.py`

## Verification

Run relevant unit/integration tests and configuration validation. Production enablement requires verified sender/domain/provider acceptance and test delivery; provider dashboard evidence remains environment-specific.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
