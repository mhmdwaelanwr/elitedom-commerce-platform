# ADR-010: Adoption of Hybrid Stock Model for Inventory and Fulfillment

**Document Classification:** Internal  
**Status:** Accepted  
**Date:** 2026  
**Target System:** Elitedom Store & Odoo 17 ERP Integration  

---

## 1. Context and Problem Statement
The Elitedom Store platform operates a hybrid business model that combines direct in-house warehouse inventory (stock-based fulfillment) with third-party supplier dropshipping. We need to define an architectural and operational mechanism to manage, synchronize, and route stock availability across multiple sourcing channels. The system must prevent overselling, accurately reflect product availability on the reactive storefront and mobile apps, and integrate seamlessly with Odoo 17 ERP multi-warehouse and dropship routing rules.

## 2. Decision Drivers
* Requirement to support dual fulfillment workflows (internal warehouse storage vs. external supplier dropshipping).
* Odoo 17 acting as the single source of truth for inventory locations, rules, and stock valuation.
* Need for real-time or near-real-time stock synchronization between supplier feeds, Odoo, and the e-commerce search/catalog layer (Algolia).
* Managing customer expectations regarding shipping lead times for different product fulfillment types.

## 3. Considered Options
* **Option 1:** Pure in-house inventory model (exclusive reliance on physical warehouse stock).
* **Option 2:** Pure dropshipping model (no owned warehouse holding, total reliance on supplier availability feeds).
* **Option 3:** Comprehensive Hybrid Stock Management model leveraging Odoo 17 multi-warehouse routing and dropshipping features.

## 4. Decision Outcome
**Chosen Option:** **Option 3 (Comprehensive Hybrid Stock Management)**. The system shall implement a hybrid stock model utilizing Odoo 17's multi-warehouse and dropship route capabilities, synchronized via event-driven middleware to update inventory availability across the e-commerce storefront and mobile applications.

## 5. Consequences
### Positive Consequences
* Broadens product catalog offerings and revenue streams without requiring high upfront capital for massive warehouse inventory.
* Enables automated purchase order generation for dropshipped items and internal transfer tracking for warehouse stock directly within Odoo 17.
* Provides clear inventory visibility and prevents customer checkout for out-of-stock items across both channels.

### Negative Consequences / Trade-offs
* Introduces complexity in synchronizing external supplier inventory feeds and handling potential stock discrepancies or delayed supplier fulfillment updates.
* Requires robust error handling and fallback routing if a dropship supplier fails to fulfill an order.

---
**End of Document**
