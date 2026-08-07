---
title: "ADR-012 — Staff TOTP MFA"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "The architectural decision, its replacement, or implementation evidence materially changes."
decision_status: Accepted
---

# ADR-012 — Staff TOTP MFA

## Status

Accepted

## Context

Administrative permissions can change commerce, customer and operational state; password/session possession alone is insufficient for privileged production access.

## Decision

Require staff MFA in staging/production using TOTP with encrypted seeds, single-use recovery codes and persisted session verification state.

## Consequences

- MFA enforcement is environment validated.
- Privileged checks use database-backed session/role state.
- Recovery material is not stored reversibly.

## Implementation evidence

- `elitedom-store/backend/app/modules/auth/mfa.py`
- `elitedom-store/backend/app/modules/auth/mfa_service.py`
- `elitedom-store/backend/app/config.py`

## Review rule

ADRs preserve decision history. Do not rewrite the original decision to match a newer implementation; supersede it with a new ADR and link the records.
