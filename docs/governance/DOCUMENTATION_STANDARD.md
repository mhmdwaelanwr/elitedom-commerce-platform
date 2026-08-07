---
title: "Documentation Standard"
status: current
owner: engineering
document_type: governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Documentation Standard behavior, evidence, or source-of-truth changes."
---

# Documentation Standard

## Purpose

Defines the minimum structure and evidence standard for Markdown maintained in this repository. The goal is reliable engineering knowledge, not decorative documentation.

## Current state

All maintained Markdown under `docs/` and `elitedom-store/docs/` is classified by status and ownership. Living pages explain implemented behavior separately from plans and external/provider acceptance. Historical release records preserve the state at the time of delivery.

## Invariants and controls

- Each governed document has one H1 and required frontmatter: title, status, owner, document_type, verified_against, and review_trigger.
- Current/operational documents identify executable source-of-truth paths and a repeatable verification method.
- Plans, targets, compliance mappings, SLOs and recovery objectives are not presented as achieved facts without evidence.
- Secrets, private endpoints, credentials, PII and real recovery codes never belong in documentation.
- Historical records are not rewritten to make old decisions look current; corrections are auditable.

## Writing conventions

Use concise engineering English, explicit units and states, concrete repository paths, and unambiguous terms such as **implemented**, **optional**, **planned**, **provider-dependent**, **historical**, or **superseded**. Prefer tables for inventories and checklists for operator gates.

## Source of truth

- `docs/governance/STATUS_MODEL.md`
- `docs/governance/SOURCE_OF_TRUTH.md`
- `elitedom-store/scripts/validate_documentation.py`

## Verification

Run the documentation validator and repository hygiene workflow. Review rendered Markdown for headings, tables and links.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
