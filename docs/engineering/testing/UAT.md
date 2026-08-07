---
title: "User Acceptance Testing"
status: current
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "User Acceptance Testing behavior, evidence, or source-of-truth changes."
---

# User Acceptance Testing

## Purpose

Defines release-level UAT gates for customer, staff and operational journeys.

## Current state

Stage 10 introduced release/environment-scoped launch acceptance. UAT evidence must be recorded against the exact release reference and must not carry to a later build automatically.

## Invariants and controls

- English and Arabic journeys, LTR/RTL and light/dark/system.
- Mobile/tablet/desktop responsive behavior and keyboard/focus accessibility.
- Authentication including phone OTP/social flows available in the target environment and staff MFA.
- Catalogue/cart/checkout/Paymob success/failure/retry/refund paths.
- Fulfillment/shipping/Odoo synchronization and service/RMA paths.
- Admin permissions/audit/content/integration/launch-control workflows.
- Backup/restore, monitoring/alert and rollback/operator acceptance.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `elitedom-store/backend/app/modules/admin/launch_service.py`
- `docs/delivery/releases/STAGE_10_UAT_GO_LIVE.md`

## Verification

Record evidence references, operator identity and release/environment in the launch control plane.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
