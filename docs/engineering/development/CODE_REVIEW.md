---
title: "Code Review Standard"
status: current
owner: engineering
document_type: development
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Code Review Standard behavior, evidence, or source-of-truth changes."
---

# Code Review Standard

## Purpose

Defines what reviewers verify beyond formatting.

## Current state

Review focuses on correctness, security boundaries, state transitions, data migration, operational behavior, tests and documentation truth.

## Invariants and controls

- Confirm authorization at backend boundaries and object ownership where applicable.
- Trace money/stock/payment/order/refund transitions for server authority and idempotency.
- Review migrations both forward and downgrade behavior.
- Review provider failure/timeout/retry and secret handling.
- Check frontend EN/AR, RTL/LTR, theme, responsive, loading/error/accessibility behavior when UI changes.
- Reject misleading docs or unsupported compliance/production claims.

## Source of truth

- `CONTRIBUTING.md`
- `docs/governance/DOCUMENTATION_STANDARD.md`
- `.github/workflows/ci.yml`

## Verification

Use PR diff, CI and targeted source/test inspection; green CI is necessary but not sufficient review.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
