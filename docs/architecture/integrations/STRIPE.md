---
title: "Stripe Legacy Integration"
status: superseded
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Stripe Legacy Integration behavior, evidence, or source-of-truth changes."
---

# Stripe Legacy Integration

## Purpose

Documents the Stripe Legacy boundary, implementation status, security controls and operational enablement requirements.

## Current state

Stripe was the original payment provider and remains in migration history plus isolated configuration/webhook compatibility code. It is no longer the primary target payment architecture; new payment work targets Paymob unless a new ADR changes that decision.

## Invariants and controls

- Do not delete old Stripe migrations from history.
- Do not present Stripe credentials as required for the Paymob production path.
- Legacy webhook behavior must remain isolated from Paymob state and tested if enabled.
- Retirement requires a dedicated data/code migration and compatibility plan.

## Enablement and failure mode

Legacy use is environment-specific; no new launch should assume Stripe is the primary provider without an explicit architectural change.

## Source of truth

- `docs/architecture/decisions/ADR-006-Stripe.md`
- `docs/architecture/decisions/ADR-011-Paymob.md`
- `elitedom-store/backend/app/integrations/stripe/`

## Verification

Run relevant unit/integration tests and configuration validation. Legacy use is environment-specific; no new launch should assume Stripe is the primary provider without an explicit architectural change.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
