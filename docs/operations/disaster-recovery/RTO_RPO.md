---
title: "RTO and RPO Objectives"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "RTO and RPO Objectives behavior, evidence, or source-of-truth changes."
---

# RTO and RPO Objectives

## Purpose

Defines how Recovery Time Objective and Recovery Point Objective are agreed and measured.

## Current state

No repository-only value is treated as a contractual RTO/RPO. Targets depend on business risk, backup frequency/storage, hosting and staffing; achieved values require drills.

## Invariants and controls

- RPO is bounded by actual backup/replication frequency and transaction recovery capability.
- RTO includes infrastructure replacement, restore, migration, validation, provider/DNS/TLS work and traffic cutover.
- Use separate objectives for critical commerce data versus optional derived indexes when appropriate.
- Revisit objectives after architecture or business criticality changes.

## Source of truth

- `docs/operations/disaster-recovery/BACKUP_STRATEGY.md`
- `docs/operations/disaster-recovery/DR_TESTING.md`

## Verification

Approve targets with business/operations and compare them with measured drill results.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
