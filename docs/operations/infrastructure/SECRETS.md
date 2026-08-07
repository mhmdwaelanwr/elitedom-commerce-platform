---
title: "Secrets Management"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Secrets Management behavior, evidence, or source-of-truth changes."
---

# Secrets Management

## Purpose

Defines handling, rotation and repository boundaries for credentials and sensitive configuration.

## Current state

The repository contains variable names/placeholders only. Core production secrets include application/JWT/database/Redis/metrics credentials plus enabled-provider keys, OAuth/provider secrets and webhook verification material.

## Invariants and controls

- Generate high-entropy values; production validation rejects known placeholders/weak core secrets.
- Keep `SECRET_KEY` and `JWT_SECRET_KEY` distinct.
- Rotate compromised secrets at the provider/runtime first; Git history cleanup alone is not remediation.
- Scope provider credentials to least privilege and separate staging/production.
- Do not place secrets in PR text, screenshots, logs, test fixtures or Markdown.
- Document rotation procedures by secret category without recording actual secret values.

## Source of truth

- `elitedom-store/.env.example`
- `elitedom-store/backend/app/config.py`
- `SECURITY.md`

## Verification

Secret-manager/runtime inspection and provider rotation tests are operational evidence; repository hygiene checks prevent tracked `.env` files.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
