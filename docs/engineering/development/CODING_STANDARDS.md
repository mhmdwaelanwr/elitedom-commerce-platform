---
title: "Coding Standards"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Coding Standards behavior, evidence, or source-of-truth changes."
---

# Coding Standards

## Purpose

Defines repository-wide implementation conventions that improve reviewability and safety.

## Current state

Python backend code is linted with Ruff and tested with pytest. TypeScript/React is linted with ESLint, type-checked and production-built. Formatting conventions are normalized by `.editorconfig`; domain correctness is more important than stylistic cleverness.

## Invariants and controls

- Prefer explicit types, small domain-focused functions/services and stable names.
- Keep HTTP/provider parsing at boundaries; keep business transitions in domain/service code.
- Do not catch broad exceptions merely to hide failures; classify/retry/fail closed intentionally.
- Use structured/masked logging; never log secrets or raw authentication material.
- Frontend hooks/components must avoid duplicated business authority and preserve accessibility/localization states.

## Source of truth

- `.editorconfig`
- `elitedom-store/backend/`
- `elitedom-store/frontend/`

## Verification

Run Ruff/pytest, frontend lint/types/build and review diffs for hidden contract changes.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
