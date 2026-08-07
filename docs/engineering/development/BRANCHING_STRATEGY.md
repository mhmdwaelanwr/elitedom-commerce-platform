---
title: "Branching Strategy"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Branching Strategy behavior, evidence, or source-of-truth changes."
---

# Branching Strategy

## Purpose

Defines a lightweight trunk-oriented branch model suitable for the repository's current team/workflow.

## Current state

Long-lived environment branches are not required by the repository. `main` is the integration branch; releases are identified by immutable refs/tags/SHAs and environment launch evidence.

## Invariants and controls

- Prefer short-lived `feature/`, `fix/`, `docs/`, or automation/agent branches.
- Never use a branch name as production evidence; use immutable release refs.
- Keep migration sequences linear unless a deliberate multi-head strategy is reviewed.
- Delete/retire merged branches according to repository policy; do not reuse stale branches for unrelated work.

## Source of truth

- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `.github/workflows/repository-hygiene.yml`

## Verification

Compare branch against `main` before review; ensure it is not unexpectedly behind or carrying unrelated commits.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
