---
title: "ZeptoMail Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "ZeptoMail Integration behavior, evidence, or source-of-truth changes."
---

# ZeptoMail Integration

## Purpose

Documents the ZeptoMail boundary, implementation status, security controls and operational enablement requirements.

## Current state

ZeptoMail has an optional asynchronous delivery implementation with explicit enable flag, HTTPS API URL, sender and bounce configuration. It can coexist with other notification adapters without becoming domain authority.

## Invariants and controls

- Only enable with a strong API key and HTTPS endpoint.
- Sender/bounce configuration must be provider-valid.
- Email tasks must not expose secrets or turn delivery failure into duplicated order/payment effects.
- Provider choice remains adapter/configuration policy.

## Enablement and failure mode

Production enablement requires verified sender/bounce configuration and live delivery evidence.

## Source of truth

- `elitedom-store/backend/app/integrations/zeptomail/tasks.py`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/app/celery_app.py`

## Verification

Run relevant unit/integration tests and configuration validation. Production enablement requires verified sender/bounce configuration and live delivery evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
