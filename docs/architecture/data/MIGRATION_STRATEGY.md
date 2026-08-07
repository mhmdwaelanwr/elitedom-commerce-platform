# Migration Strategy & Execution Plan (MIGRATION_STRATEGY.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (PostgreSQL 15, Alembic, Odoo ORM)  

---

## 1. Executive Summary & Migration Philosophy
This document defines the comprehensive migration strategy for the **Elitedom Store** platform. As an e-commerce ecosystem tightly coupled with an **Odoo 17 ERP** backend, database and data migrations must be handled with extreme precision to prevent data loss, minimize system downtime, and ensure seamless synchronization between storefront microservices (FastAPI), external search indexes (Algolia), and ERP inventory records.

The migration strategy is built on three core pillars:
* **Idempotency & Repeatability:** All schema and data migration scripts must be safely repeatable without corrupting state.
* **Backward Compatibility ("Expand and Contract"):** Zero-downtime schema migrations must support rolling deployments where old and new application versions run concurrently.
* **Strict Traceability:** Preservation of unique serial numbers (`stock_lot`), customer accounts (`res_partner`), and transaction history during data imports.

---

## 2. Migration Tooling & Architecture
The Elitedom ecosystem utilizes dual-layer migration tooling depending on the component:

### 2.1. FastAPI Backend & Custom Microservices (`Alembic`)
* **Tool:** Alembic (PostgreSQL migration manager).
* **Scope:** Custom tables, e-commerce session tracking, webhook logs, RMA tickets, Hedera audit hashes, and B2B quotation tables.
* **Execution:** Automated via CI/CD pipelines prior to containerized API deployment.

### 2.2. Odoo 17 ERP Core (`Odoo ORM & XML Data`)
* **Tool:** Odoo built-in module upgrade engine (`-u module_name`) and XML data files.
* **Scope:** Core inventory models (`product.template`, `stock.picking`, `stock.lot`), financial ledgers (`res.currency`), and tax/pricelist rules.
* **Execution:** Managed via controlled staging and production deployment scripts.

---

## 3. Schema Migration Lifecycle & Workflow

To maintain stability across staging and production environments, schema changes follow a strict lifecycle:

1. **Development & Scripting:** 
   * Developers write explicit forward and backward (`upgrade()` / `downgrade()`) Alembic scripts or Odoo model updates.
   * Direct database modifications in production are strictly prohibited.
2. **Peer Review & Automated Linting:**
   * Migration scripts undergo mandatory code review focusing on index locks, foreign key constraints, and nullable column definitions.
   * Automated tests verify that migrations run cleanly on a fresh PostgreSQL instance.
3. **Staging Environment Dry-Run:**
   * Migrations are executed against a staging replica populated with sanitized production-like data to measure execution time and check for lock contention.
4. **Production Deployment:**
   * Executed during scheduled maintenance windows (for major ERP structural changes) or via rolling zero-downtime deployments (for non-breaking API table additions).

---

## 4. Initial & Historical Data Migration Plan

When onboarding legacy data or performing major system version upgrades, data is migrated using structured ETL (Extract, Transform, Load) scripts in Python/Pandas.

### 4.1. Customer & Partner Migration (`res_partner`)
* **Source:** Legacy CSV/SQL database dumps.
* **Mapping:** Clean email normalization, phone formatting (Egyptian mobile standards +20), and assignment of default B2C/B2B pricelists.
* **Validation:** Duplicate checks based on unique email and phone constraints.

### 4.2. Product Catalog & Hardware Matrix Migration (`product.template` & `product.product`)
* **Source:** Supplier inventory spreadsheets and legacy e-commerce catalogs.
* **Mapping:** Import of base costs in USD, target margins, computed EGP retail prices, and PC Builder compatibility attributes (`socket_type`, `ram_type`, `form_factor`, `power_wattage_draw`).
* **Validation:** Verification of SKU uniqueness and category tree hierarchy mapping.

### 4.3. Serial Number (`stock_lot`) & Inventory Seed
* **Source:** Physical warehouse stock intake logs.
* **Mapping:** Import of active serial numbers linked to respective product variants with initial warehouse location assignments.
* **Validation:** Ensuring 100% uniqueness constraint compliance on serial number strings.

---

## 5. Zero-Downtime Deployment & "Expand-and-Contract" Pattern

To avoid service interruptions for active storefront shoppers during database upgrades, breaking schema changes must follow the **Expand and Contract** pattern:

* **Phase 1 (Expand):** Add new columns or tables as nullable or with safe default values. Deploy application code that can write to both old and new columns.
* **Phase 2 (Migrate):** Run background data backfill scripts to populate the new columns from legacy data.
* **Phase 3 (Switch):** Deploy updated application code that reads exclusively from the new columns.
* **Phase 4 (Contract):** In a subsequent release, drop the deprecated legacy columns and constraints.

---

## 6. Rollback & Disaster Recovery Procedures

Every migration package must include a verified rollback plan:

1. **Pre-Migration Snapshot:** Automated creation of a full PostgreSQL snapshot and Odoo filestore backup prior to executing any production migration.
2. **Downgrade Validation:** Alembic `downgrade` scripts must be tested in staging to ensure clean reversion of schema changes without orphaned data corruption.
3. **Emergency Incident Response:** If a migration fails or causes critical latency spikes in production:
   * Immediately halt the deployment pipeline.
   * Restore the database snapshot to the pre-migration point if data corruption occurred.
   * Revert application containers to the previous stable Docker image tag.

---

## 7. Post-Migration Validation & Smoke Testing

Following the completion of any database migration or ERP module update, the following automated verification checks must pass:
* **Schema Integrity Check:** Verify all foreign key constraints and indexes are active and valid (`pg_stat_user_indexes`).
* **Row Count Reconciliation:** Compare record counts between pre-migration staging checkpoints and post-migration environments for critical tables (`res_partner`, `product_product`, `stock_lot`).
* **API Smoke Tests:** Execute automated integration test suites against FastAPI endpoints to verify authentication, product catalog search, and cart checkout flows.

---
End of Document
