---
title: "Domain Model"
status: reference
owner: architecture
document_type: domain-model
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Bounded-context ownership, aggregate boundaries, persistence ownership, or cross-domain invariants change."
---

# Domain Model

## Purpose

Provides the domain-level map used to reason about ownership, aggregate boundaries, and cross-domain invariants. It intentionally does not duplicate the physical schema; Alembic migrations and SQLAlchemy models are authoritative for exact persistence details.

## Domain areas

### Identity and access

Owns customer/staff identity, credentials and social/phone identity flows, persisted sessions, OTP state, staff MFA credentials, authorization roles/permissions, and security-relevant session state. Privileged access is evaluated from backend-persisted authority rather than browser claims.

### Catalogue and content

Owns product/category representation, publication/content fields, media metadata, search/catalogue exposure, and identifiers used to correlate catalogue records with ERP data. Publication state and media lifecycle are explicit application concerns.

### Customer commerce

Owns account profile/address data, anonymous/authenticated carts, cart lines, order intent, sale orders, order lines, commercial totals, currency, and customer-visible order history. Pricing, stock, discounts, shipping, and payable totals remain server-authoritative.

### Payments and refunds

Owns provider attempts/records, provider identifiers, verified callback outcomes, payment transitions, reconciliation information, and refunds/refund requests. Paymob is the primary provider boundary; legacy Stripe compatibility remains isolated and historical migration state is preserved.

### Inventory and fulfillment

Owns application-facing stock/inventory structures, serial/lot references where modeled, fulfillment/shipment/tracking state, and the application side of ERP synchronization. Odoo remains the ERP system boundary rather than a second application database accessed directly.

### Warranty and RMA

Owns warranty eligibility checks, RMA/service requests, claim status and links to order/product/serial evidence. Eligibility and ownership are service rules, not assumptions derived solely from submitted IDs.

### Supplier and B2B operations

Owns supplier mappings/procurement-facing application data and B2B/RFQ/quote capabilities exposed by the FastAPI modules. ERP or external-system interaction remains behind explicit integration contracts.

### Administration and control plane

Owns backend-enforced staff operations, configuration/status views, payment/refund operations, integration readiness, audit history, and release/environment-scoped launch acceptance. UI permission visibility is subordinate to backend permission checks.

### Integration reliability

Owns webhook receipts/idempotency state, transactional outbox/delivery state, retry/dead-letter behavior where implemented, and provider/ERP correlation identifiers. These records exist to make distributed delivery observable and repeat-safe.

## Aggregate and consistency principles

- A bounded context owns its state transitions even when another context displays the result.
- Cross-system consistency with Odoo/payment/notification/search providers is achieved through explicit adapters, verified callbacks, idempotency, and asynchronous delivery patterns—not cross-database transactions.
- Historical commerce/payment records are not reconstructed from mutable current catalogue/provider data.
- Security-sensitive transitions require server-side authorization and, where applicable, persisted session/MFA state.
- Release acceptance is scoped to an immutable release reference and environment; evidence does not carry across releases implicitly.

## Source of truth

- `elitedom-store/backend/app/models.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/integrations/`
- `elitedom-store/backend/alembic/versions/`

## Verification

Use ORM models, migration history, service/router boundaries, integration tests, and authorization tests to confirm this map. When code ownership moves between modules, update this page and the relevant context/architecture documentation together.

## Maintenance rule

Keep this page conceptual. Do not turn it into a second database dictionary or endpoint list; those contracts have their own authoritative sources and documentation.
