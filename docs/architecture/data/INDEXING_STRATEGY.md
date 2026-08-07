# Indexing Strategy & Performance Optimization Document (INDEXING_STRATEGY.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (PostgreSQL 15 & Algolia Search)  

---

## 1. Executive Summary & Objectives
This document outlines the multi-tier indexing strategy for the **Elitedom Store** platform. As an e-commerce platform integrating real-time hardware catalogs, high-frequency checkout transactions, and Odoo 17 ERP backbones, maintaining low query latency and high search responsiveness is critical. 

The strategy covers:
* **Relational Database Indexing (PostgreSQL):** Optimizing foreign keys, transactional lookups, and full-text search fields.
* **Search Engine Indexing (Algolia):** Powering sub-100ms product catalog discovery and dynamic faceted filtering for hardware components.
* **Cache & Memory Indexing (Redis / Application Layer):** Accelerating shopping carts, user sessions, and frequent configuration queries.

---

## 2. PostgreSQL Database Indexing Strategy (Odoo 17 Core)

To prevent table scans and ensure optimal performance for transactional operations, specific index types are applied across core entities.

### 2.1. B-Tree Indexes (Foreign Keys & Lookups)
Standard B-Tree indexes are applied to high-cardinality foreign keys and unique lookup identifiers to speed up JOIN operations and filtering.
* `res_partner(email)`: Unique index for fast customer authentication and lookup.
* `res_partner(phone)`: Index for quick SMS/OTP association via Twilio.
* `product_product(sku)`: Unique index for barcode and SKU scanning during warehouse picking.
* `stock_lot(name)`: Unique index on physical Serial Numbers (S/N) for instant warranty and traceability queries.
* `sale_order(partner_id)` & `sale_order(odoo_order_id)`: Indexes to optimize customer order history retrieval and ERP synchronization.

### 2.2. Partial Indexes (Active & Filtered Data)
To reduce index size and memory overhead, partial indexes are applied to frequently filtered active subsets.
* **Active Sales Orders:** Index on `sale_order(id)` where `state NOT IN ('cancel', 'done')` to optimize active cart and fulfillment dashboard queries.
* **Dropship Vendors:** Index on `res_partner(id)` where `is_dropship_vendor = TRUE` for rapid procurement routing.

### 2.3. Full-Text Search Indexes (PostgreSQL GIN)
For internal administrative search fallback, Generalized Inverted Indexes (GIN) are used on textual columns.
* `product_template(name, description)`: GIN index utilizing `to_tsvector` for robust internal catalog searching.

---

## 3. Algolia Search Indexing Strategy (Storefront & Mobile App)

As defined in `ADR-007`, Algolia handles client-facing product discovery to offload compute load from PostgreSQL.

### 3.1. Record Structure & Attributes
Each hardware product record pushed to Algolia includes structured facets and attributes to support the future PC Builder engine:
* `objectID`: Unique Odoo product variant ID.
* `name`: Product display title.
* `list_price_egp`: Current computed retail price in EGP (used for numerical price filtering/sorting).
* `socket_type`: Facet attribute (e.g., `LGA1700`, `AM5`).
* `ram_type`: Facet attribute (e.g., `DDR4`, `DDR5`).
* `form_factor`: Facet attribute (e.g., `ATX`, `ITX`).
* `power_wattage_draw`: Integer attribute for power supply compatibility checks.
* `in_stock`: Boolean attribute reflecting real-time inventory availability from Odoo multi-warehouse routing.

### 3.2. Ranking & Relevance Configuration
* **Custom Ranking:** Prioritize products with active stock (`in_stock: true`) and high conversion metrics.
* **Typo Tolerance:** Enabled with strict prefix searching on part numbers and model names (e.g., searching "i7-147" instantly returns "Intel Core i7-14700K").

### 3.3. Real-Time Synchronization Pipeline
* **Webhook / Middleware Trigger:** Whenever product stock levels change in Odoo 17 or prices are updated via currency rate shifts, FastAPI background workers push incremental index updates to Algolia via REST API.

---

## 4. Cache & Memory Indexing Strategy (Redis)

Redis is deployed as an in-memory data store for transient operational data:
* **User Sessions & JWT Blacklists:** Stored with automatic TTL (Time-To-Live) expiration to manage secure customer and staff sessions.
* **Cart Persistence:** Temporary guest and user shopping carts are indexed by session tokens for sub-millisecond retrieval before checkout conversion.
* **Currency Exchange Rate Cache:** Daily USD/EGP rates fetched from the financial ledger are cached in Redis to avoid redundant database reads during storefront price calculations.

---

## 5. Maintenance, Monitoring & Optimization

* **Index Bloat Monitoring:** Regular execution of PostgreSQL statistics queries (`pg_stat_user_indexes`) to identify unused or bloated indexes.
* **Vacuum and Analyze:** Automated nightly vacuum schedules to maintain optimal B-Tree index health.
* **Query Performance Logging:** Slow query logging enabled in PostgreSQL (threshold > 200ms) to detect unindexed analytical queries from the admin reporting dashboard.

---
End of Document
