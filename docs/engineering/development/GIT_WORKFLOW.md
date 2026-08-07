---
title: "Git Workflow"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Git Workflow behavior, evidence, or source-of-truth changes."
---

# Git Workflow

## Purpose

Defines safe repository change flow and history expectations.

## Current state

`main` represents the integrated green baseline. Feature/fix/docs work is developed on short-lived focused branches and proposed through pull requests.

## Invariants and controls

- Branch from current green `main`.
- Use descriptive branch names and commits that explain intent.
- Do not rewrite shared `main` history.
- Open draft PRs for CI/early review; mark ready when coherent and green.
- Resolve conflicts by preserving current behavior/tests rather than mechanically taking one side.
- Merge only with the repository's explicit approval/review process.

## Source of truth

- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `.github/workflows/repository-hygiene.yml`

## Verification

PR metadata, branch base/head and CI runs provide the audit trail.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
