---
title: "Risk Register"
status: current
owner: delivery
document_type: delivery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Risk Register behavior, evidence, or source-of-truth changes."
---

# Risk Register

## Purpose

Maintains engineering/launch risks that require explicit ownership or evidence.

## Current state

Current high-value risks include external provider acceptance, production secret provisioning, asset licensing, deployment/backup/monitoring maturity, legacy payment compatibility and drift between documentation/configuration and real environments.

## Invariants and controls

- Provider risk: Paymob/Twilio/OAuth/email/Odoo live credentials and account configuration require real acceptance.
- Data risk: restore/rollback and provider/ERP reconciliation must be proven.
- Security risk: secret exposure, privileged access, proxy/network misconfiguration and provider callback authenticity.
- Operational risk: untested monitoring/alerts or unsupported automatic failover assumptions.
- Legal/commercial risk: product media licensing, privacy/retention and merchant/compliance obligations require owner review.
- Technical debt: legacy Stripe and planned/scaffold integrations must stay clearly isolated.

## Source of truth

- `docs/operations/`
- `docs/architecture/integrations/`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Review at release planning and after incidents/provider/topology changes; close risks only with evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
