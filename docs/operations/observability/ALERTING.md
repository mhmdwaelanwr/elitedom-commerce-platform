---
title: "Alerting Standard"
status: current
owner: operations
document_type: observability
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Alerting Standard behavior, evidence, or source-of-truth changes."
---

# Alerting Standard

## Purpose

Defines alert design and response expectations without claiming a specific monitoring vendor/configuration is already deployed.

## Current state

Alert rules are environment-specific launch evidence. Repository docs define what should be alerted; the production monitoring system must prove delivery/ownership.

## Invariants and controls

- Page on customer-impacting availability/readiness or severe payment/data/security symptoms, not every warning log.
- Alert on sustained error/latency/worker backlog and critical provider/DB/Redis readiness failures.
- Use separate severity for degraded optional integrations.
- Every alert has an owner, runbook link, actionable threshold/window and test evidence.

## Source of truth

- `docs/operations/runbooks/INCIDENT_RESPONSE.md`
- `docs/operations/runbooks/MONITORING.md`

## Verification

Trigger representative staging alerts and record notification/triage evidence before launch.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
