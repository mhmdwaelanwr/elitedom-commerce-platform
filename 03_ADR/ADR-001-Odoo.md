# ADR-001: Selection of Odoo 17 as ERP Master Backbone

**Document Classification:** Internal  
**Status:** Accepted  
**Date:** 2026  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Context and Problem Statement
Elitedom Store requires a robust, scalable, and fully integrated enterprise resource planning (ERP) backbone to manage complex operational domains, including inventory, procurement, sales orders, accounting, and warehouse management. We need to evaluate whether to build a custom enterprise management backend from scratch or adopt an established, extensible ERP framework that can act as the master system of record.

## 2. Decision Drivers
* Need for a single source of truth for inventory, fulfillment, and financial ledgers.
* Out-of-the-box capabilities for multi-currency pricing, supplier management, and hardware serial tracking.
* Extensibility to support a modular monolith architecture and custom API middleware.
* Reduced development overhead and time-to-market compared to writing custom ERP modules from scratch.

## 3. Considered Options
* **Option 1:** Custom-built backend services for inventory, orders, and accounting.
* **Option 2:** Heavy proprietary enterprise ERP solutions (e.g., SAP/Oracle).
* **Option 3:** Odoo 17 Enterprise/Community ERP framework.

## 4. Decision Outcome
**Chosen Option:** **Option 3 (Odoo 17)**, because it provides extensible core business capabilities, native Python/PostgreSQL architecture, strong community support, and high extensibility that aligns with our technology stack. Required business functions shall be validated against the selected Odoo 17 deployment edition and any approved custom or third-party modules. Odoo 17 shall remain the master owner of inventory, procurement, sales orders, and warehouse operations. Financial/accounting workflows shall be provided through the validated Odoo deployment configuration, including any required custom or third-party modules, and shall not be assumed to be Community Edition functionality without validation.

## 5. Consequences
### Positive Consequences
* Centralized, reliable management of core business logic and financial transactions.
* Native support for stock tracking, multi-currency ledgers, and structured database schemas (`res_partner`, `product_product`, `stock_lot`, etc.).
* Accelerated deployment timeline by leveraging pre-built business workflows.

### Negative Consequences / Trade-offs
* Requires a dedicated API integration middleware layer to handle real-time synchronization between the reactive storefront/mobile app and Odoo.
* Custom developments must follow Odoo's framework conventions to maintain compatibility during future system upgrades.

---
**End of Document**
