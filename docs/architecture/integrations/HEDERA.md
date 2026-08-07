---
title: "Hedera Integration Scaffold"
status: planned
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Hedera Integration Scaffold behavior, evidence, or source-of-truth changes."
---

# Hedera Integration Scaffold

## Purpose

Documents the Hedera Scaffold boundary, implementation status, security controls and operational enablement requirements.

## Current state

Hedera-related task/configuration scaffolding exists, but the application intentionally rejects `HEDERA_ENABLED=true` because real HCS submission is not implemented as a supported production capability.

## Invariants and controls

- Do not label Hedera as production implemented.
- Fail-closed configuration is intentional until a real signed submission/receipt path and tests exist.
- Any future enablement requires a new/updated ADR, secret-handling design, retry/idempotency and test evidence.

## Enablement and failure mode

No environment should enable Hedera today; configuration validation must reject it.

## Source of truth

- `elitedom-store/backend/app/integrations/hedera/tasks.py`
- `elitedom-store/backend/app/config.py`

## Verification

Run relevant unit/integration tests and configuration validation. No environment should enable Hedera today; configuration validation must reject it.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
