# Stage 5 — Paymob Payments

## Goal

Replace new electronic checkout sessions with Paymob Intention API and Unified Checkout while keeping historical Stripe identifiers readable for orders created before the migration.

## Delivered backend foundation

- Server-priced Paymob intentions for card and mobile-wallet checkout.
- Paymob-hosted Unified Checkout URLs; the storefront never handles card data.
- Provider-neutral payment attempt, webhook receipt, and refund records.
- Stable idempotency keys for payment attempts and full refund requests.
- SHA-512 transaction callback HMAC verification using Paymob's documented field order.
- Callback replay protection and a durable processing result for each callback state.
- Amount, currency, payment-method integration ID, order reference, and attempt validation before order state changes.
- Payment success confirms the order and creates dropship purchase orders.
- Payment failure releases local inventory exactly once.
- Late payment success re-reserves local inventory before fulfillment.
- Verified refund callbacks complete pending refund records without changing fulfillment stock.
- A non-PII public status endpoint lets guest checkout return pages poll by the unguessable order reference created by the backend.

## Database migration

`0009_paymob_payment_records` creates:

- `elitedom_payment_attempt`
- `elitedom_payment_webhook_event`
- `elitedom_payment_refund`

The migration supports latest-revision downgrade/replay and full downgrade/replay through the PostgreSQL CI job.

## Environment variables

- `PAYMOB_ENABLED`
- `PAYMOB_SECRET_KEY`
- `PAYMOB_PUBLIC_KEY`
- `PAYMOB_HMAC_SECRET`
- `PAYMOB_CARD_PAYMENT_METHOD_ID`
- `PAYMOB_WALLET_PAYMENT_METHOD_ID`
- `PAYMOB_CURRENCY`
- `PAYMOB_BASE_URL`
- `PAYMOB_UNIFIED_CHECKOUT_URL`
- `PAYMOB_NOTIFICATION_URL`
- `PAYMOB_REDIRECTION_URL`
- `PAYMOB_TIMEOUT_SECONDS`

Paymob remains disabled until all required sandbox or production values are supplied. Callback and redirect URLs must use HTTPS when enabled.

## Security decisions

- Redirect query parameters are never treated as proof of payment.
- Only a transaction callback with a valid HMAC can change payment state.
- Provider amounts and currencies must exactly match the immutable local payment attempt.
- Callback retries are idempotent.
- Secret and HMAC keys never enter frontend responses.
- The hosted checkout URL contains only Paymob's public key and per-attempt client secret.
- Raw callback bodies and customer payment details are not persisted.
- Phone-only accounts must provide a deliverable checkout email; their internal compatibility address is never sent to Paymob.

## Refund policy

The public Paymob documentation currently describes dashboard void operations but does not expose a stable refund API contract in the general documentation path. Elitedom therefore creates an auditable refund request and marks it complete only after a verified Paymob callback. A direct provider refund/void executor must not be enabled until the merchant account exposes and validates its exact API contract.

## Legacy Stripe boundary

- New card and wallet checkouts do not create Stripe sessions.
- Historical Stripe identifiers remain readable for existing orders and support migration/audit needs.
- The old Stripe integration is not the active checkout provider.

## Validation matrix

- Paymob disabled before checkout mutation.
- Card and wallet intentions use server totals and configured method IDs.
- Payment attempts persist immutable minor-unit amount and currency.
- Correct success callback confirms once.
- Callback replay is ignored.
- Amount mismatch is rejected.
- Currency mismatch is rejected.
- Integration ID mismatch is rejected.
- Failed payment releases stock once.
- Verified refund callback completes a pending refund.
- Phone-only accounts use the checkout billing email instead of their internal compatibility email.
- Frontend redirects to hosted checkout and never displays redirect success as confirmed payment.
- Backend Ruff/pytest, migration replay, Odoo tests, frontend lint/type-check/build, and Compose validation are green.

## Deferred until merchant credentials are available

- Sandbox end-to-end payment using the merchant's real card and wallet method IDs.
- Merchant-specific direct refund/void API execution.
- Production callback-domain verification and go-live payment-method enablement.
- Settlement reconciliation against merchant reports.
