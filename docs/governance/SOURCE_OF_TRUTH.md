---
title: "Source-of-Truth Policy"
status: current
owner: engineering
document_type: governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Source-of-Truth Policy behavior, evidence, or source-of-truth changes."
---

# Source-of-Truth Policy

## Purpose

Defines which artifact wins when code, configuration, tests, provider behavior and documentation disagree.

## Current state

Elitedom treats executable constraints as stronger evidence than prose. Documentation is expected to follow the implementation, while architecture decisions govern intentional future changes before implementation when explicitly marked.

## Invariants and controls

- Database migrations and constraints are authoritative for persisted schema.
- Backend authorization and transition code is authoritative for security and business-state enforcement.
- `.env.example`, `app/config.py`, and Compose manifests are authoritative for configuration names and deployment validation.
- CI workflows are authoritative for repository quality gates.
- Provider dashboards/contracts are authoritative only for environment-specific external values; secrets are never copied here.
- Historical release records are evidence of past delivery, not a current contract.

## Source of truth

- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/main.py`
- `.github/workflows/ci.yml`

## Verification

Compare a claim with its listed executable source and relevant tests before marking it current.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
