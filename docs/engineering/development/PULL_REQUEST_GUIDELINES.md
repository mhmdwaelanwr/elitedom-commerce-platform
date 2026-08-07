---
title: "Pull Request Guidelines"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Pull Request Guidelines behavior, evidence, or source-of-truth changes."
---

# Pull Request Guidelines

## Purpose

Defines the minimum information and scope quality for reviewable pull requests.

## Current state

PRs are focused change units. They explain why the change exists, what contracts/data/operations change, how it was verified, and what remains manual/provider-dependent.

## Invariants and controls

- Use a specific title and concise problem/solution summary.
- Call out migrations, API/security/provider/config/deployment changes explicitly.
- Include test/CI evidence, not screenshots as the only proof.
- Document rollback or compatibility implications for operationally significant changes.
- Keep PR draft until coherent; do not merge with known failing required checks.

## Source of truth

- `.github/PULL_REQUEST_TEMPLATE.md`
- `CONTRIBUTING.md`

## Verification

Reviewers should be able to reproduce or inspect every claimed verification item.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
