---
title: "Documentation Change Policy"
status: current
owner: engineering
document_type: governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Documentation Change Policy behavior, evidence, or source-of-truth changes."
---

# Documentation Change Policy

## Purpose

Defines when documentation changes are mandatory and how documentation-only changes avoid altering historical truth.

## Current state

Documentation is part of the product's engineering contract. Behavioral changes update the relevant living docs in the same PR; pure documentation corrections use a focused docs branch and still pass validation.

## Invariants and controls

- API, auth, payment, webhook, schema, deployment or operational changes require corresponding living-doc updates.
- New providers require an integration page and, for durable architectural choices, an ADR.
- Migration changes update data/migration documentation when invariants or operations change.
- Release records are added at release milestones and never used as current API/runbook documentation.
- Broken links, stale version claims, unsafe commands and obsolete primary-provider statements are defects.

## Source of truth

- `CONTRIBUTING.md`
- `.github/workflows/repository-hygiene.yml`

## Verification

Run documentation validation locally and in CI. Use PR diff review to confirm history was not silently rewritten.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
