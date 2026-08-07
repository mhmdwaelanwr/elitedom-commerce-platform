---
title: "SLI and SLO Policy"
status: current
owner: operations
document_type: observability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "SLI and SLO Policy behavior, evidence, or source-of-truth changes."
---

# SLI and SLO Policy

## Purpose

Defines how service indicators/objectives are established without inventing production guarantees.

## Current state

The repository does not treat unmeasured example percentages as established SLAs. SLOs must be approved with business/operational owners and backed by production-like measurement.

## Invariants and controls

- Define SLIs for customer-visible availability, API success/latency and critical checkout/payment paths.
- Define measurement source/window/exclusions before setting an objective.
- Separate optional-provider degradation from core service availability where product behavior supports fallback.
- Track error budget policy only after a stable SLO is agreed.
- RTO/RPO are recovery objectives and must align with backup/restore evidence.

## Source of truth

- `docs/operations/observability/`
- `docs/operations/disaster-recovery/RTO_RPO.md`

## Verification

Approve targets and demonstrate measurement queries/dashboards; do not mark planned values as achieved.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
