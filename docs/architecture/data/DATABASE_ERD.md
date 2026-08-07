---
title: "Database Relationship Map"
status: reference
owner: architecture
document_type: database-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Aggregate relationships, ORM ownership, migration constraints, or launch-evidence persistence changes."
---

# Database Relationship Map

## Purpose

Summarizes the most important persisted aggregate relationships in the FastAPI application database. This is a navigational ERD-level view; Alembic migrations and SQLAlchemy models remain authoritative for exact columns, foreign keys, indexes, nullability, and constraint names.

## Core relationship map

### Identity and access

A user/customer identity is related to persisted authentication sessions and identity-verification state. Staff authorization adds database-backed role/permission assignments and audit records. Staff MFA credentials and session MFA verification are separate persisted security concerns rather than frontend-only state.

### Customer → address/cart/order

Customer identity owns account-scoped commerce objects such as addresses, persisted carts, and orders. Anonymous cart state can exist before authentication and is reconciled through application rules rather than by trusting browser ownership claims.

### Order → order lines → product

An order owns line snapshots for the commercial transaction. Product catalogue state can change later, so historical order totals/line values are not reconstructed blindly from current product pricing. Inventory and fulfillment references connect operational state to the order lifecycle.

### Order → payment attempt → refund

Payment attempts/results belong to an order while retaining provider-specific identifiers and state. Refund records/requests are related to payment/order state but follow explicit refund transitions instead of mutating the original payment record as an unstructured flag.

### Product → category/media/inventory/supplier mapping

Product records connect catalogue representation to categories/content, media, inventory/serial information, supplier relationships, and ERP identifiers. Media metadata and storage objects are coordinated through application lifecycle rules rather than represented as arbitrary filesystem paths.

### Order/product → warranty/RMA

Warranty/RMA eligibility relates claims to owned commerce history and product/serial information where applicable. Eligibility is evaluated through service rules; persistence alone is not authorization.

### External event → receipt/outbox/delivery state

Inbound provider/ERP messages use receipt/idempotency data to prevent repeated business effects. Outbound integration work can use transactional outbox/delivery state so durable application changes and asynchronous external delivery are coordinated without cross-system transactions.

### Release/environment/gate → launch acceptance

Manual launch evidence is scoped by `release_ref`, environment, and gate key. This uniqueness is what prevents a passed UAT/provider/recovery gate from a previous release from being inherited silently by a different release candidate.

## Database boundaries

The FastAPI application database and Odoo database are separate. No relationship in this document implies a cross-database foreign key. Cross-system identity is represented through provider/ERP identifiers and integration contracts.

## Source of truth

- `elitedom-store/backend/alembic/versions/`
- `elitedom-store/backend/app/models.py`
- `elitedom-store/backend/app/modules/`
- `elitedom-store/backend/app/modules/admin/models.py`

## Verification

Use the Alembic migration graph, ORM models, database integration tests, and migration replay CI. For a generated physical ERD, generate it from the migrated schema rather than copying this narrative into a second schema definition.

## Maintenance rule

Update this map with changes to aggregate ownership, durable integration/reliability records, authentication/authorization persistence, payment/refund relationships, or launch acceptance. Do not copy every schema column into Markdown; that creates a competing source of truth.
