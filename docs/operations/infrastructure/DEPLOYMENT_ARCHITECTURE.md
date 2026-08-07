---
title: "Deployment Architecture"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Deployment Architecture behavior, evidence, or source-of-truth changes."
---

# Deployment Architecture

## Purpose

Describes how repository artifacts become an environment deployment.

## Current state

Frontend and backend images are built from repository Dockerfiles. Compose overlays apply environment behavior. The production FastAPI service forces production mode, disables debug, requires staff MFA and Redis rate limiting; frontend build requires public API/site URLs.

## Invariants and controls

- Build from an immutable release reference.
- Inject secrets at deployment; never bake them into images or source.
- Run migrations as an intentional release step before/with application rollout according to the runbook.
- Do not mark deployment healthy until readiness and external smoke pass.
- Keep rollback artifact/database implications understood before cutover.

## Source of truth

- `elitedom-store/infrastructure/`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `.github/workflows/launch-smoke.yml`

## Verification

Validate Compose, deploy staging from the release ref, run migrations/readiness/smoke and capture evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
