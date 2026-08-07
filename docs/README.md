# Elitedom Documentation

This directory is the repository knowledge base. It is organized by engineering responsibility rather than by delivery order so the documentation can scale with the platform.

## Information architecture

```text
docs/
├── product/
│   ├── foundation/          Vision, capabilities, glossary
│   └── requirements/        Business, functional, security and NFR requirements
├── architecture/
│   ├── overview/            Solution architecture, domain model and principles
│   ├── decisions/           Architecture Decision Records (ADRs)
│   ├── c4/                  C4 context, container, component and deployment views
│   ├── data/                Database schema, ERD, indexing and migration strategy
│   ├── api/                 API contracts, security, webhooks and versioning
│   └── integrations/        External-system architecture and contracts
├── engineering/
│   ├── workflows/           Business/system workflows and state machines
│   ├── design/              UI/UX system, flows and brand guidance
│   ├── testing/             Test plans, cases, security/performance and UAT
│   └── development/         Coding, Git, review and local-development standards
├── operations/
│   ├── infrastructure/      Deployment, environments, networking and secrets policy
│   ├── runbooks/            Operations, incidents, backup and maintenance
│   ├── observability/       Logs, metrics, tracing, alerts, dashboards and SLOs
│   ├── data-governance/     Classification, retention, privacy and PII handling
│   ├── disaster-recovery/   DR strategy, RTO/RPO, restore and failover
│   └── compliance/          Compliance scope, controls and audit readiness
└── delivery/
    ├── project-management/  Roadmap, releases, risks, changes and decisions
    └── releases/            Stage-by-stage implementation reports
```

## Source-of-truth rules

- Executable behavior is defined by code under [`../elitedom-store/`](../elitedom-store/), its migrations, tests and CI workflows.
- Architecture documentation explains intent and constraints; when an older document conflicts with the current implementation, the implementation plus the newest accepted decision/report wins until the older document is explicitly superseded.
- ADRs are historical decision records. Superseded decisions should be retained and marked as superseded rather than silently rewritten.
- Environment secrets never belong in documentation or source control.
- Implementation-specific runbooks and operational reports that are tightly coupled to the executable platform remain under [`../elitedom-store/docs/`](../elitedom-store/docs/).

## Start here

- Platform overview: [`../README.md`](../README.md)
- Product foundation: [`product/foundation/PROJECT_FOUNDATION.md`](product/foundation/PROJECT_FOUNDATION.md)
- Requirements: [`product/requirements/BUSINESS_REQUIREMENTS.md`](product/requirements/BUSINESS_REQUIREMENTS.md)
- Solution architecture: [`architecture/overview/SOLUTION_ARCHITECTURE.md`](architecture/overview/SOLUTION_ARCHITECTURE.md)
- Architecture decisions: [`architecture/decisions/`](architecture/decisions/)
- C4 model: [`architecture/c4/`](architecture/c4/)
- Development standards: [`engineering/development/`](engineering/development/)
- Operations: [`operations/runbooks/`](operations/runbooks/)
- Go-live runbook: [`../elitedom-store/docs/GO_LIVE_RUNBOOK.md`](../elitedom-store/docs/GO_LIVE_RUNBOOK.md)
- Delivery history: [`delivery/releases/`](delivery/releases/)

This structure is enforced by repository hygiene checks so documentation cannot drift back into numbered root folders.
