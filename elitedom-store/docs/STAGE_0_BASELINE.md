# Stage 0 — Green Baseline and Delivery Inventory

Baseline commit: `87b9d29f0f6f551bc8d570293b08e09faa2038c5`

This document records the verified starting point before the storefront redesign, bilingual theme system, phone authentication, Paymob, and expanded administration work.

## Current architecture

| Area | Current implementation |
| --- | --- |
| Storefront | Next.js 16, React 19, Tailwind CSS 4 |
| API | FastAPI, Pydantic, SQLAlchemy async |
| Application database | PostgreSQL 15 |
| ERP | Odoo 17 Community with bundled `elitedom_connector` addon |
| Background work | Celery and Redis |
| Deployment | Docker Compose development and production overlays |
| Product media | Local filesystem volume mounted at `/app/media` in Docker |
| Payments | Stripe integration remains present; Paymob is not implemented yet |
| Authentication | Email/password plus backend Google and Apple token verification |
| Authorization | Fixed application roles; operation-level permission matrix is not implemented |

## Confirmed delivered capabilities

- Odoo inventory, product-catalogue, sale-order, and shipment callbacks.
- Signed Odoo webhooks with HMAC verification and idempotent delivery receipts.
- Odoo transactional outbox, retry, leasing, and dead-letter handling.
- Product/category upsert from Odoo by SKU.
- Staff product editing, archive/publish controls, stock corrections, and product media management.
- Public product APIs and a storefront that reads live catalogue data.
- PostgreSQL migration replay checks and native Odoo addon installation/tests in CI.
- Development and production Docker Compose validation.

## Stage 0 failure found

The backend test job imported `app.main`, which creates the configured media directory. The configuration default was `/app/media`, a correct container path but an invalid default on a non-container GitHub runner. The import failed before pytest collection with `PermissionError: [Errno 13] Permission denied: '/app'`.

## Stage 0 corrective action

- Keep Docker configuration explicit through `MEDIA_ROOT=/app/media` in `.env.example`.
- Change the application fallback to the process-local relative directory `media`.
- Add a regression test proving the fallback is relative and writable from a normal process working directory.

No database migration is required. No environment variable is added or renamed. No file is deleted in this stage.

## Verified gaps for the next delivery stages

### Storefront and design system

- The root layout currently forces English and dark mode.
- Semantic theme tokens and persisted light/dark/system preference are missing.
- Arabic translations, RTL switching, locale-aware currency/date formatting, and translation files are missing.
- Product variants, advanced search suggestions, persisted wishlists, verified reviews, and content-managed homepage sections need completion.

### Authentication

- Phone-first registration and OTP request/verification are missing.
- OTP hashing, expiry, resend cooldown, abuse limits, and provider abstraction are missing.
- Google and Apple need complete browser flows, account linking, and profile-completion handling.
- Refresh-token revocation and multi-device session management need hardening.

### Payments and commercial checkout

- Paymob payment-intention/checkout integration is missing.
- Paymob HMAC callbacks, payment-attempt idempotency, refunds, reconciliation, and retry pages are missing.
- The server must remain authoritative for price, stock, shipping, discount, and payable total calculations.

### Administration and permissions

- Current roles must evolve into backend-enforced operation permissions.
- Dashboard KPIs, content management, payment/refund operations, configurable roles, and complete audit history need expansion.

### Production readiness

- Object storage/CDN for product media.
- Production secrets and provider accounts.
- Shipping carrier integration and COD settlement.
- Backup restore drills, monitoring, alerting, security review, legal policies, taxes, and production UAT.

## Stage 0 acceptance gate

Stage 0 is complete only when the pull request and the resulting `main` run pass all of the following:

1. Backend Ruff and full pytest suite.
2. Frontend ESLint, TypeScript, and production build.
3. Odoo 17 addon validation, installation, and native tests.
4. PostgreSQL upgrade, downgrade, and replay.
5. Development and production Docker Compose validation.

The next implementation stage starts from this green baseline and must not mix unrelated product features into the CI repair pull request.
