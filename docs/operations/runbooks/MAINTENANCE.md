---
title: "Maintenance Runbook"
status: current
owner: operations
document_type: runbook
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Maintenance Runbook behavior, evidence, or source-of-truth changes."
---

# Maintenance Runbook

## Purpose

Defines planned maintenance preparation, execution and verification.

## Current state

Maintenance includes dependency/image upgrades, database migrations, provider/config changes, certificate/host work and data cleanup. Changes must preserve rollback/recovery understanding.

## Invariants and controls

- Define scope, release ref, expected impact and rollback point.
- Check backup/recovery state before destructive or schema-changing work.
- Prefer rolling/reversible operations when architecture supports them.
- Validate health/readiness/smoke and key commerce/provider paths after maintenance.
- Document any temporary control change and restore it before closure.

## Source of truth

- `elitedom-store/infrastructure/`
- `docs/engineering/development/PULL_REQUEST_GUIDELINES.md`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Use change-specific CI/staging verification and post-maintenance operational smoke.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
