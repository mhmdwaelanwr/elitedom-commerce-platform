---
title: "Change Log"
status: current
owner: delivery
document_type: delivery
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Change Log behavior, evidence, or source-of-truth changes."
---

# Change Log

## Purpose

Summarizes major repository capability changes. Git history and release records remain authoritative for exact commits.

## Current state

The project evolved from architecture/baseline material into an integrated commerce platform through staged releases. This log is intentionally high level and does not duplicate every commit.

## Invariants and controls

- Stages 0–1: established green baseline and removed retired/generated repository ambiguity.
- Stages 2–3: design system, bilingual storefront/discovery and commerce/account flows.
- Stage 4: phone-first authentication, social/session hardening.
- Stage 5: Paymob payment integration and payment lifecycle.
- Stage 6: fulfillment lifecycle and ERP synchronization.
- Stage 7: admin RBAC, permissions and audit.
- Stage 8: catalog content/media management.
- Stage 9: security/MFA/rate limiting, object media, observability/SEO/performance hardening.
- Stage 10: release-scoped launch acceptance, external smoke and go-live runbook.
- Repository architecture: professionalized monorepo/docs layout and hygiene enforcement.

## Source of truth

- `docs/delivery/releases/`
- `README.md`

## Verification

Update only for material capability/release milestones; use release records for detailed evidence.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
