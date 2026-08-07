---
title: "Elitedom Engineering Knowledge Base"
status: current
owner: engineering
document_type: documentation-index
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Repository architecture, runtime behavior, operational procedures, or documentation governance changes."
---
# Elitedom Engineering Knowledge Base

This directory is the authoritative engineering knowledge base for Elitedom. Its purpose is to let an engineer, operator, reviewer, or auditor distinguish implemented behavior from requirements, plans, historical decisions, and environment-specific evidence.

## Information architecture

| Area | Purpose |
| --- | --- |
| [`product/`](product/README.md) | Product foundation, capabilities, requirements, use cases, traceability |
| [`architecture/`](architecture/README.md) | System architecture, data/API contracts, ADRs, integrations, C4 views |
| [`engineering/`](engineering/README.md) | Development practices, testing, UI/design guidance, workflows |
| [`operations/`](operations/README.md) | Infrastructure, runbooks, observability, recovery, data governance, compliance readiness |
| [`delivery/`](delivery/README.md) | Roadmap, risk/decision logs, release plans, historical stage records |
| [`governance/`](governance/README.md) | Documentation status, ownership, source-of-truth and maintenance rules |

## Truth hierarchy

When documentation and executable behavior disagree, use this order until the mismatch is corrected:

1. security and data constraints enforced by code/database;
2. executable tests and migrations;
3. runtime configuration validation and deployment manifests;
4. living documentation marked `current` or `operational`;
5. plans/reference documents;
6. historical release records and superseded ADRs.

A documentation/code mismatch is a defect and should be corrected in the same change whenever practical.

## Document statuses

- **current** — describes current implemented behavior or governing policy.
- **operational** — procedure intended for real operator execution; still requires environment-specific evidence.
- **reference** — curated reference derived from more authoritative executable sources.
- **planned** — target behavior not guaranteed to exist.
- **historical** — immutable delivery/history record.
- **superseded** — decision or design retained for history but replaced.

See [`governance/STATUS_MODEL.md`](governance/STATUS_MODEL.md).

## Production-readiness rule

No Markdown file may declare the platform production-ready merely because CI is green. Public launch is release-specific and requires the launch control plane, provider acceptance, smoke tests, backup/restore proof, monitoring, rollback readiness, and UAT evidence.
