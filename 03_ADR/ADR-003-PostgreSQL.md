# ADR-003: Selection of PostgreSQL as Primary Database Management System

**Document Classification:** Internal  
**Status:** Accepted  
**Date:** 2026  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Context and Problem Statement
The Elitedom Store platform requires a powerful, reliable, and fully ACID-compliant relational database management system to handle complex business domains, including customer profiles, multi-level product catalogs, inventory tracking, multi-currency ledgers, and sales orders. Furthermore, since our core enterprise backend is powered by Odoo 17 ERP, we need to select a database engine that ensures seamless integration, strict traceability, and optimal performance for both e-commerce operations and enterprise management.

## 2. Decision Drivers
* Native database requirement and deep integration compatibility with Odoo 17 ERP.
* Strict ACID compliance and data integrity guarantees for financial accounting and inventory transactions.
* Robust support for complex relational schemas, foreign keys, constraints, and audit logs.
* Proven capability to support strict traceability, hardware compatibility engines, and dynamic multi-currency pricing.

## 3. Considered Options
* **Option 1:** NoSQL Document Stores (e.g., MongoDB) for flexible schema design.
* **Option 2:** Alternative Relational Databases (e.g., MySQL / MariaDB).
* **Option 3:** PostgreSQL relational database management system.

## 4. Decision Outcome
**Chosen Option:** **Option 3 (PostgreSQL)**. PostgreSQL shall serve as the primary database management system running via Odoo 17 ERP, supporting strict traceability, hardware compatibility engines, and dynamic multi-currency pricing.

## 5. Consequences
### Positive Consequences
* Flawless native compatibility with Odoo 17 ERP, eliminating middleware translation layers for database queries within the ERP boundary.
* Superior handling of complex transactions, relational data structures (`res_partner`, `product_product`, `stock_lot`, `sale_order`), and data integrity enforcement.
* Extensive community tooling, backup mechanisms, and robust indexing strategies.

### Negative Consequences / Trade-offs
* Requires careful resource planning and connection pooling to handle concurrent heavy traffic from both the reactive web/mobile storefronts and internal ERP operations.

---
**End of Document**
