---
title: "User Acceptance Testing"
status: operational
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Critical customer/staff journeys, launch manual gates, provider acceptance, accessibility scope, or evidence requirements change."
---

# User Acceptance Testing

## Purpose

Defines release-level UAT for customer, staff, provider, and operational journeys that cannot be proven completely by repository CI. UAT produces evidence for a specific immutable release reference and target environment.

## Evidence and scoping

Stage 10 introduced release/environment-scoped launch acceptance. A UAT pass is valid only for the release/environment against which it was executed and recorded. A later candidate must not inherit a previous candidate's pass automatically.

A useful evidence reference identifies the test run or approved artifact without copying secrets or customer PII into Git. Passing a required launch gate requires evidence; waiving a gate requires explicit operator rationale.

## Experience matrix

### English and Arabic

Validate equivalent critical functionality in English and Arabic, correct LTR/RTL direction, translated navigation/forms/status messages, locale-aware EGP display, date/number formatting where applicable, and no layout mirroring defects that block task completion.

### Theme and responsive behavior

Validate light, dark, and system preference behavior across representative mobile, tablet, and desktop viewports. Critical screens must preserve readable contrast, usable controls, stable loading/empty/error states, and non-overlapping content.

### Accessibility smoke

At minimum validate keyboard navigation, visible focus, semantic/labelled form controls, actionable error feedback, appropriate heading/navigation structure, and critical screen-reader-friendly names for customer/admin actions. Automated checks assist but do not replace keyboard/screen-reader judgment for critical flows.

## Customer journey matrix

### Identity and account

- password sign-in/registration behavior that remains supported;
- phone OTP request, cooldown/abuse controls, verification, resend and failure behavior in the target provider environment;
- Google and Apple sign-in/account-link/profile-completion behavior when enabled;
- refresh/session behavior and logout/revocation;
- account/profile/address management;
- staff MFA enrollment/verification/recovery behavior for privileged staff paths.

### Catalogue and discovery

- homepage/content sections;
- category/product listing;
- search/filter/sort/pagination behavior as delivered;
- product details, availability, media and localized content;
- wishlist/review/content features that are part of the release candidate.

### Cart and checkout

- anonymous cart persistence and authenticated cart behavior;
- anonymous-to-authenticated cart merge;
- server-authoritative price/discount/shipping/stock validation;
- address/shipping selection;
- Paymob initiation using configured card/wallet methods;
- success, pending, cancelled/failed, callback-delay, retry and duplicate-callback behavior from the user's perspective;
- order confirmation/history/status after verified provider processing.

### Post-purchase

- fulfillment/shipping/tracking state;
- return/refund workflow and Paymob refund acceptance;
- warranty eligibility/RMA/service flows;
- customer-visible behavior when Odoo/provider work is delayed or retried.

## Staff/admin matrix

Validate permission boundaries for roles relevant to the release. A staff member without permission must not gain access by calling the API directly even if the UI is manipulated.

Critical admin areas include dashboard/control views, catalogue/content/media, user/access management, audit history, payments/refunds, integration readiness, fulfillment/service operations, and launch control. Staff MFA must be enforced according to target configuration.

## Provider and ERP acceptance

For enabled production-path providers, execute real target-account acceptance rather than relying on mocked CI:

- Paymob payment/callback/refund/reconciliation;
- Google sign-in;
- Apple sign-in;
- Twilio OTP;
- Odoo catalogue/inventory/order/shipment round trip and signed/idempotent event processing.

Optional disabled providers should be recorded as disabled, not marked passed without execution.

## Operational acceptance

UAT/go-live evidence also covers:

- application and Odoo backup/restore drill;
- public HTTPS launch smoke;
- dependency readiness;
- logs/metrics/tracing behavior as configured;
- alert routing to the intended operator;
- rollback drill/previous-known-good release path.

## Exit criteria

A release can leave UAT only when required launch gates for its release/environment are passed or explicitly waived with an approved risk rationale, no unresolved critical customer/security/data-loss defect remains, and rollback/monitoring ownership is established.

## Source of truth

- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/backend/app/modules/admin/control_schemas.py`
- `elitedom-store/backend/app/tests/integration/test_stage10_launch_acceptance.py`
- `docs/delivery/releases/STAGE_10_UAT_GO_LIVE.md`

## Verification

Record evidence references, verifier identity, timestamp, release reference, and environment in the launch control plane. Retain defect/waiver context in the appropriate delivery/operations system without committing sensitive provider or customer information.

## Change policy

Update this UAT matrix whenever a critical journey, required launch gate, provider path, accessibility baseline, or evidence model changes.
