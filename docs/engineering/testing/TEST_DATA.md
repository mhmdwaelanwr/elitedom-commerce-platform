---
title: "Test Data Policy"
status: current
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Test Data Policy behavior, evidence, or source-of-truth changes."
---

# Test Data Policy

## Purpose

Defines how deterministic test/demo data is separated from production/customer/provider data.

## Current state

Automated tests use fixtures/factories/local database state and placeholder credentials. Local seed data is development-only and must not create default production credentials or depend on private provider accounts.

## Invariants and controls

- Never copy real customer PII, production tokens, provider secrets or payment payloads into fixtures.
- Use explicit example domains/phone numbers/provider IDs where syntax requires values.
- Idempotent local seeding is allowed; tests must not depend on execution order or an existing developer database.
- Media fixtures must be small, licensed/appropriate and validated like real uploads.

## Source of truth

- `elitedom-store/backend/app/tests/`
- `elitedom-store/backend/app/seed.py`
- `elitedom-store/.env.example`

## Verification

Run tests from a clean environment and confirm no tracked secret/runtime-state violations.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
