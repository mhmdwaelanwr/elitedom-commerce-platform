---
title: "Documentation Ownership"
status: current
owner: engineering
document_type: governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Documentation Ownership behavior, evidence, or source-of-truth changes."
---

# Documentation Ownership

## Purpose

Maps documentation classes to the team responsibility that must review changes. Ownership describes responsibility, not GitHub identity or organization structure.

## Current state

The repository uses functional ownership labels so documentation remains valid even if individual maintainers change.

## Invariants and controls

- `product`: capability intent, requirements and acceptance semantics.
- `architecture`: system boundaries, API/data contracts, ADRs and integration architecture.
- `engineering`: development workflow, design system, testing and documentation governance.
- `operations`: deployment, incident, observability, recovery, secrets and operational controls.
- `delivery`: roadmap, risk, release planning and historical release evidence.

## Source of truth

- `docs/README.md`
- `CONTRIBUTING.md`

## Verification

Every PR changing a living document should be reviewable by the functional owner indicated in frontmatter.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
