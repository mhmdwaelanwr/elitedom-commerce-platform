---
title: "Use Cases"
status: reference
owner: product
document_type: use-cases
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Critical customer, staff, provider, fulfillment, service, or launch-control journeys change."
---

# Use Cases

## Purpose

Summarizes the primary customer, staff, system, and operator journeys implemented by the platform. This page describes outcomes and trust boundaries; route-level schemas and UI details remain owned by executable code.

## Actors

- **Anonymous customer** — browses catalogue and may build a cart before authentication.
- **Authenticated customer** — manages account/address state and completes commerce/post-purchase journeys.
- **Staff user** — performs authorized administrative/operations work subject to backend RBAC and staff MFA policy.
- **Operations/release operator** — evaluates runtime readiness and records release-scoped acceptance evidence.
- **Paymob** — primary payment provider callback/checkout boundary.
- **Odoo** — ERP boundary for catalogue, stock, order, and shipment synchronization.
- **Optional providers** — Google, Apple, Twilio, SendGrid/ZeptoMail, Algolia, and other enabled adapters according to implementation/configuration status.

## UC-01 — Browse and discover catalogue

**Precondition:** storefront/API are available.  
**Primary flow:** customer opens home/category/search/product views, changes locale/theme as needed, reviews product/media/availability data, and navigates to a purchasable product.  
**Controls:** catalogue publication rules and API data are server-provided; Arabic/RTL and English/LTR remain supported presentation modes.  
**Failure outcome:** empty/error/loading states remain usable and do not fabricate stock or price.

## UC-02 — Build and retain a cart

**Precondition:** catalogue item is eligible for cart addition.  
**Primary flow:** anonymous or authenticated customer adds/removes/updates lines and continues browsing. Anonymous cart state can later be reconciled with authenticated state.  
**Controls:** browser totals are display values; checkout revalidates price, discount, shipping, stock, and payable amount server-side.  
**Failure outcome:** invalid/unavailable lines produce explicit correction/error behavior rather than silent order creation.

## UC-03 — Establish customer identity

**Primary flows:** supported password flow, phone OTP, or Google/Apple identity flow establishes/links an application identity and persisted session.  
**Phone controls:** hashed/expiring OTP state, resend cooldown and abuse/rate limits; real delivery depends on enabled target provider configuration.  
**Social controls:** provider identity is verified through the implemented backend flow and linked without trusting arbitrary browser profile claims.  
**Failure outcome:** invalid/expired credentials or unsafe provider configuration fail without creating a trusted session.

## UC-04 — Manage account and addresses

Authenticated customer manages profile/address information, views order history, and resumes commerce flows. Object ownership must be enforced by backend queries/services rather than by accepting arbitrary object IDs from the browser.

## UC-05 — Checkout and initiate Paymob payment

**Preconditions:** valid cart, customer/order context, shipping/address requirements satisfied, Paymob enabled for the target payment method when used.  
**Primary flow:** backend computes authoritative commercial state, creates/persists order/payment attempt state, and initiates Paymob hosted/unified checkout.  
**Authority rule:** browser redirection does not mark payment successful. Verified backend/provider callback processing is authoritative.  
**Failure outcome:** failed/cancelled/pending provider states remain explicit and retry/reconciliation behavior does not duplicate business effects.

## UC-06 — Receive a Paymob callback

Paymob calls the dedicated backend webhook boundary. The backend verifies authenticity, resolves the target attempt/order, applies idempotency, and advances state only through valid transitions. Duplicate delivery returns a safe repeat result rather than repeating fulfillment/payment side effects.

## UC-07 — Fulfill an order and synchronize Odoo

Application/Odoo integration exchanges catalogue/inventory/order/shipment events using signed/idempotent/retry-safe boundaries. Staff/system advances valid fulfillment/shipment states while ERP delivery failure remains observable/retryable rather than being treated as silent success.

## UC-08 — Request and process a refund

Authorized workflow validates the payment/order/refund state, creates or advances refund state, calls the relevant provider path, and keeps audit/provider identifiers needed for reconciliation. Repeated requests must not produce duplicate provider refunds.

## UC-09 — Submit and process warranty/RMA

Customer with eligible owned order/product context submits a service/warranty request and supporting information. Backend eligibility/ownership rules determine whether the claim can proceed. Staff advances only allowed service/RMA transitions; future external intake adapters must preserve the same domain authority.

## UC-10 — Administer catalogue/content/media

Authorized staff manages product/category/content/publication/media state through admin APIs/UI. Backend permission checks remain authoritative. Media upload validates supported type/size/dimensions/content and coordinates storage/database lifecycle safely.

## UC-11 — Administer access and audit activity

Authorized staff reviews/manages roles/permissions according to the implemented RBAC model. Staff MFA is enforced where configured. Security-sensitive administrative actions produce audit information; manipulating frontend visibility cannot grant a backend permission.

## UC-12 — Operate payments, integrations, and fulfillment

Authorized staff inspects payment/refund state, integration readiness, fulfillment/service information, and provider/ERP operational status through the control/admin surfaces. Provider credentials remain secret and are never returned as raw configuration values to the browser.

## UC-13 — Approve a release for launch

**Precondition:** immutable release reference and target environment selected.  
**Primary flow:** backend control plane evaluates automatic deployment/security/provider gates; operator completes required manual gates and records evidence.  
**Evidence controls:** a passed manual gate requires evidence; a waived gate requires rationale; verifier/time are recorded.  
**Isolation:** evidence is queried by release reference and environment, so another release's UAT/provider/recovery pass does not carry automatically.  
**Outcome:** release remains blocked while required blockers exist.

## UC-14 — Detect and respond to degraded runtime

Operator uses liveness/readiness, logs, metrics/tracing where configured, worker/provider/ERP signals, and runbooks to identify degradation. Interventions should be scoped/reversible and preserve data/payment/order correctness; destructive reset/restore actions require explicit recovery context.

## Source of truth

- `elitedom-store/frontend/src/app/`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Verification

Use backend/frontend/integration tests for executable behavior and release-level UAT for provider/environment/customer experience. Requirements/user stories should trace to these use cases where they represent the same business outcome.

## Maintenance rule

Update this page when an actor, critical journey, authority boundary, or release acceptance outcome changes. Do not duplicate every screen or endpoint here.
