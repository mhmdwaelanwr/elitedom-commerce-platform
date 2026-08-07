---
title: "Deployment Guide"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Deployment Guide behavior, evidence, or source-of-truth changes."
---

# Deployment Guide

## Purpose

Provides a safe deployment sequence. Exact infrastructure commands may be adapted to the target host, but safety gates are invariant.

## Current state

Deployment is release-scoped and should be performed only after CI is green and required launch gates are ready for the target environment.

## Invariants and controls

- Use an immutable commit/tag and verified repository state.
- Provision production `.env`/secret-manager values separately from Git.
- Validate Compose with production overlay before changing running services.
- Take/verify backup according to release risk and migration plan.
- Apply Alembic migrations, deploy containers, then confirm liveness/readiness.
- Run external launch smoke against public HTTPS endpoints.
- Observe error/latency/worker/provider behavior before final sign-off.

## Source of truth

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Capture command outputs/monitoring/smoke evidence outside secrets and attach references to the release gate.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
