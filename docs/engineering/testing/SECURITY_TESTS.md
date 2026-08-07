---
title: "Security Testing"
status: current
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Security Testing behavior, evidence, or source-of-truth changes."
---

# Security Testing

## Purpose

Defines automated and manual security verification expectations.

## Current state

Repository tests cover configuration hardening, auth/MFA boundaries, webhook/integration safety, permission enforcement, security headers, metrics protection and release-control behavior. Live infrastructure/network/provider review remains a deployment task.

## Invariants and controls

- Test authentication and authorization failures, not only successful paths.
- Test forged/stale role claims against persisted authorization state.
- Test invalid/duplicate webhook signatures/events.
- Test production config rejection for weak secrets, unsafe URLs, missing MFA/Redis controls.
- Test rate-limit and protected metrics/security headers.
- Treat penetration testing and external dependency/network scanning as release/environment evidence, not implicit CI coverage.

## Source of truth

- `elitedom-store/backend/app/tests/`
- `SECURITY.md`
- `elitedom-store/backend/app/config.py`

## Verification

Run backend suites and review launch UAT/security evidence for the exact environment.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
