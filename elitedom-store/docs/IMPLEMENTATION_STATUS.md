# Elitedom Store — Implementation Status

This file maps the architecture workspace to the runnable codebase. It is an
operational hand-off, not a substitute for the source documents in the parent
workspace.

## Implemented in this repository

| Documentation area | Delivered implementation |
| --- | --- |
| Foundation, requirements, architecture, ADR and C4 | Modular FastAPI bounded contexts, a Next.js storefront, Odoo boundary, PostgreSQL, Redis/Celery, and Docker topology follow the published architecture. |
| Data and API | Versioned `/api/v1` APIs; Alembic migrations; separate Store and Odoo databases; RBAC, JWT, CORS, rate limiting, HMAC webhook verification, idempotency receipts, and validated schemas. |
| Customer storefront | Template assets and visual patterns are integrated into Next.js 16 pages for home, discovery, search, filters, product detail, cart, guest checkout, account, wishlist, B2B, and warranty. |
| Administration | Role-protected `/admin` console and `/api/v1/admin` operations for KPIs, orders, catalog/stock, customers, RMA, B2B RFQs/quotes, and dispatch. |
| Commerce and stock | Persistent carts, guest checkout, Stripe Checkout, webhook verification/idempotency, stock reservation/release, local inventory, serial flows, fulfillment, warranty/RMA, and B2B quotes. |
| Procurement and hybrid fulfillment | Supplier master data, PO lifecycle and receipts, supplier performance reports, verified product-supplier routing, and durable dropship hand-off after payment confirmation. |
| Odoo integration | A bundled Odoo 17 addon emits signed inventory, sale-order and picking events through a durable Odoo outbox; FastAPI mirrors stock/fulfillment, creates idempotent Odoo sales orders, and prevents webhook loops/regressions. |
| Integration reliability | FastAPI and Odoo transactional outboxes, row leases, `SKIP LOCKED`, exponential retry, dead letters, persistent idempotency keys, and explicit feature gates. |
| Reporting | Role-scoped dashboard, sales series, inventory valuation, supplier and RMA reporting, plus sales CSV and non-PII PDF exports. |
| Infrastructure and deployment | Separate development and production Compose behavior, bundled read-only Odoo addon mount, non-root standalone Next.js image, loopback-only administrative ports, database bootstrap, health checks, and environment validation. |
| Operations and DR | Dual-database compressed backup script, explicit-target restore confirmation, retention cleanup, health endpoint, connector runbook, smoke checks, and Makefile workflows. |
| Observability and governance | JSON logs with PII masking, `X-Request-ID`, Prometheus RED metrics at `/metrics`, optional OTLP tracing, sanitized outbox payloads, minimized report data, and no provider response-body retention in the Odoo outbox. |
| Testing | Unit/integration coverage plus a checkout → Stripe payment → Odoo sales order → signed Odoo callback contract test. CI also installs the addon into a clean Odoo 17 database and runs its native tests. |

## Third-party integration readiness

| Provider | Repository status |
| --- | --- |
| SendGrid | Order confirmations and secure PDF-invoice links are implemented. The provider is disabled by default and requires `SENDGRID_ENABLED=true` plus a real key and verified sender. |
| ZeptoMail | Single transactional-email delivery uses the official HTTPS REST endpoint. It is disabled by default and requires an Agent send token. |
| Hedera | SHA-256 payload generation exists, but real Consensus Service submission is not implemented. The feature is disabled and configuration rejects attempts to enable it, preventing fabricated transaction IDs. |
| Odoo | The Odoo 17 producer addon, durable webhook outbox, signed FastAPI ingestion, XML-RPC order synchronization, Docker mount, install/upgrade commands and contract tests are included. Real API-user credentials and the shared webhook secret remain operator-provided. |

## Operator-provided prerequisites

The code intentionally does not invent third-party identities, payments, or
production secrets. These must be configured in the root `.env` and in the
provider consoles before the corresponding capability is enabled:

- Stripe account, Checkout URLs, webhook endpoint/signing secret, and tax/legal review.
- Odoo API user/key, shared generated webhook secret, supplier contracts, accounting setup, and white-label label templates.
- Algolia, Twilio, SendGrid or ZeptoMail, Zoho, carrier, object-storage, OAuth, and DNS/TLS credentials as applicable.
- A real Hedera SDK/client and persistence design before `HEDERA_ENABLED` can be supported.
- A private Prometheus scrape path plus an OTLP collector/Jaeger endpoint if tracing export is desired.
- Off-site encrypted backup replication, restore drills, production monitoring/alert routes, and the compliance evidence required for the organization’s actual PCI/privacy scope.

## Local acceptance sequence

```bash
cd elitedom-store
make dev
make migrate
make seed
make admin-bootstrap
make odoo-install-connector
# Provision the restricted Odoo API user/key and enable ODOO_SYNC_ENABLED.
make odoo-smoke
make test-e2e
```

Then visit `http://localhost:3000`, sign in at `/admin` with the development
administrator created by the bootstrap command, inspect Odoo at
`http://localhost:8069`, and inspect API docs at `http://localhost:8000/docs`.
