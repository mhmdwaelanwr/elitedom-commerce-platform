---
title: "Compliance Readiness Matrix"
status: current
owner: operations
document_type: compliance-readiness
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Compliance Readiness Matrix behavior, evidence, or source-of-truth changes."
---

# Compliance Readiness Matrix

## Purpose

Maps engineering controls to common privacy/payment/security concerns without claiming formal certification.

## Current state

Elitedom can document technical controls relevant to privacy and payment-security obligations, but legal applicability, PCI scope and certification depend on the operating entity, provider contracts and external assessment.

## Invariants and controls

- Identity/access: backend RBAC, staff MFA, sessions and audit controls.
- Payment: hosted Paymob flow/provider identifiers; no intended raw card storage in application.
- Data protection: secret handling, PII minimization, authorization and retention governance.
- Operational security: hardened production config, TLS/host/CORS expectations, monitoring/recovery procedures.
- Software assurance: CI, migrations, Odoo tests, repository/documentation hygiene.

## Source of truth

- `docs/operations/compliance/SECURITY_CONTROLS.md`
- `docs/operations/compliance/PCI_DSS_SCOPE.md`
- `docs/operations/data-governance/`

## Verification

Compliance claims require external/legal assessment; this matrix is engineering evidence preparation only.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
