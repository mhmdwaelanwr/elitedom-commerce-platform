---
title: "Failover Policy"
status: current
owner: operations
document_type: disaster-recovery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Failover Policy behavior, evidence, or source-of-truth changes."
---

# Failover Policy

## Purpose

Defines failover expectations while explicitly distinguishing supported recovery from unimplemented automatic HA.

## Current state

The repository does not establish automatic multi-region failover by itself. Compose is a portable single-environment topology; operators may rebuild/restore on replacement infrastructure using backups and immutable release refs.

## Invariants and controls

- Do not advertise automatic failover unless the deployment actually provisions/tests it.
- Prefer controlled traffic cutover after restored readiness/smoke.
- Reconfigure DNS/TLS/provider callbacks only through approved environment procedures.
- Protect against split-brain writes when old and replacement environments overlap.

## Source of truth

- `docs/operations/disaster-recovery/DR_STRATEGY.md`
- `docs/operations/infrastructure/DEPLOYMENT_ARCHITECTURE.md`

## Verification

Failover capability must be proven by environment drill, including traffic/callback behavior.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
