---
title: "Security Controls Catalogue"
status: current
owner: operations
document_type: compliance-readiness
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Security Controls Catalogue behavior, evidence, or source-of-truth changes."
---

# Security Controls Catalogue

## Purpose

Summarizes implemented and operationally required security controls.

## Current state

Controls span secure configuration, authentication/MFA, authorization, integration authenticity/idempotency, rate limiting, headers/metrics protection, secret handling, audit and recovery.

## Invariants and controls

- Preventive: strong config validation, MFA, RBAC, TrustedHost/CORS, provider validation, least-exposed network topology.
- Detective: structured logs, metrics, audit records and launch evidence.
- Corrective: session/provider secret rotation, rollback, backup/restore and incident procedures.
- Assurance: security/config tests, CI, repository/documentation validators.

## Source of truth

- `SECURITY.md`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/backend/app/middleware/`
- `elitedom-store/backend/app/tests/`

## Verification

Map each control to executable evidence and deployment evidence; mark gaps rather than assuming coverage.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
