---
title: "Development Guidelines"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Development Guidelines behavior, evidence, or source-of-truth changes."
---

# Development Guidelines

## Purpose

Provides the practical workflow for changing the platform safely.

## Current state

Development starts from the canonical `elitedom-store/` runtime root and latest green `main`. Backend, frontend, Odoo, migrations, Compose, launch assets and documentation are independently validated but expected to evolve coherently.

## Invariants and controls

- Make focused changes on branches; do not mix unrelated feature/refactor/provider work.
- Run the smallest relevant local checks early, then the full applicable CI gates.
- Preserve server-authoritative commerce/security semantics.
- Update living docs with behavior; preserve release/ADR history.
- Never commit secrets, generated caches, local media or runtime state.

## Source of truth

- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `.github/workflows/repository-hygiene.yml`
- `elitedom-store/Makefile`

## Verification

Use Makefile commands and CI workflows; repository/documentation hygiene must remain green.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
