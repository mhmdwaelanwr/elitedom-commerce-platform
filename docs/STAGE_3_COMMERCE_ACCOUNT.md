# Stage 3 — Product, Cart, Checkout, and Account

## Scope

This delivery completes PR-E from the market-readiness plan without changing authentication providers, payment gateways, order-state contracts, Odoo synchronization, or database schemas.

## Product detail

- live product loading through the public catalogue API
- semantic light and dark styling
- Arabic and English UI
- responsive gallery and thumbnail selection
- stock-aware quantity controls
- add-to-cart and buy-now actions
- wishlist support
- SKU, warranty, fulfilment, and specification display
- live related-product discovery without production mock data
- loading, unavailable, and API error states

## Cart

- localized responsive cart page
- stock-aware quantity updates
- removal and save-to-wishlist actions
- locale-aware price formatting
- server-contract-compatible VAT and delivery estimate
- clear empty-cart and checkout actions

## Checkout

- guest and authenticated checkout paths
- saved-address selection
- delivery form and governorate selection
- card, wallet/InstaPay, and cash-on-delivery choices using the existing checkout contract
- loyalty-point preference for authenticated customers
- localized validation and failure states
- order success state and optional hosted payment redirect

Payment-provider replacement is intentionally deferred to the Paymob stage. This PR does not claim Paymob readiness.

## Account

- localized account dashboard
- loyalty and recent-order summaries
- locale-aware order dates and totals
- profile editing
- saved-address creation, default selection, and deletion
- sign-out and unauthenticated states

## Safety

- no database migration
- no environment variable change
- no backend API contract change
- no Odoo contract change
- no payment gateway change
- no file deletion

## Validation gate

The PR must pass:

- locale key parity and design-system contract checks
- ESLint
- TypeScript
- Next.js production build
- backend Ruff and pytest
- Odoo addon installation and tests
- PostgreSQL migration replay
- development and production Docker Compose validation

## Manual acceptance matrix

- English + Light
- English + Dark
- Arabic + Light
- Arabic + Dark
- product loading, gallery, quantity, cart, buy-now, and wishlist
- cart quantity, removal, save-to-wishlist, empty state, and totals
- guest checkout
- authenticated checkout with saved addresses and loyalty preference
- cash, card, and wallet selections under the existing payment contract
- order success and external payment redirect
- account dashboard, profile update, address creation/default/deletion, and sign-out

## Deferred

- Phone OTP, Google and Apple account linking
- refresh-token rotation and session revocation
- Paymob Intention API, HMAC webhook processing, refunds, and reconciliation
- inventory reservation and storefront order-state redesign
- advanced RBAC and audit logging
