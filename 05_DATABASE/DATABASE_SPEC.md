# Database Specification & Architecture Document (DATABASE_SPEC.md)

## 1. Executive Summary & Schema Philosophy
This document details the relational database architecture for **Elitedom Store**, running on PostgreSQL via **Odoo 17 ERP**. 

The schema is built to support:
* **Strict Traceability:** Full unique Serial Number (S/N) tracking per high-value unit for warranty validation.
* **Hardware Compatibility Engine:** Dedicated specification attributes to power future PC Builder algorithms and mobile applications.
* **Dynamic Multi-Currency & Margin Rules:** Live USD exchange rate integration with automated EGP retail recalculations to protect profit margins.
* **Multi-Tier B2B Pricing:** Automated quantity-break pricelists for corporate and educational clients.
* **API & Mobile Readines:** Decoupled design ensuring smooth REST/GraphQL API consumption for web and future native mobile apps.

---

## 2. Core Entities & Advanced Attribute Schema

### A. Customer, Partner & App Entity (`res_partner`)
Stores B2C shoppers, B2B corporate clients, dropship vendors, and mobile app authentication tokens.

* `id` (Primary Key)
* `name` (VARCHAR) - Full name or Company legal name.
* `company_type` (ENUM) - `person` (B2C) | `company` (B2B).
* `email` (VARCHAR, Unique, Indexed) - Primary contact/login credential.
* `phone` (VARCHAR) - Mobile contact for SMS notifications (Twilio).
* `pricelist_id` (Foreign Key -> `product_pricelist`) - Assigned price tier (Standard Retail vs. B2B Corporate).
* `is_dropship_vendor` (BOOLEAN) - Flag for third-party suppliers.
* `mobile_fcm_token` (VARCHAR, Optional) - Push notification token for future Mobile App.

### B. Hardware Product & Compatibility Matrix (`product_template` & `product_product`)
Stores product master data along with technical hardware compatibility parameters.

* `id` (Primary Key)
* `name` (VARCHAR) - Hardware name (e.g., Intel i7-14700K, ASUS RTX 4070).
* `tracking` (ENUM) - `serial` (Unique S/N per item) | `barcode` (Standard SKU).
* `base_cost_usd` (DECIMAL) - Sourcing cost in foreign currency.
* `target_margin_percent` (DECIMAL) - Profit margin applied to cost.
* `list_price_egp` (DECIMAL) - Final computed retail price in EGP.
* **Compatibility Matrix Fields:**
  * `socket_type` (VARCHAR) - e.g., `LGA1700`, `AM5`.
  * `ram_type` (VARCHAR) - e.g., `DDR4`, `DDR5`.
  * `form_factor` (VARCHAR) - e.g., `ATX`, `Micro-ATX`, `ITX`.
  * `power_wattage_draw` (INT) - Power consumption in Watts.
  * `pcie_gen` (VARCHAR) - e.g., `PCIe 4.0 x16`, `PCIe 5.0`.

### C. Unique Serial Number Tracking (`stock_lot`)
Ensures full auditability and handles item-level warranty claims.

* `id` (Primary Key)
* `name` (VARCHAR, Unique, Indexed) - Physical Serial Number (S/N) scanned at intake.
* `product_id` (Foreign Key -> `product_product`) - Associated hardware item.
* `sale_order_id` (Foreign Key -> `sale_order`) - Order through which the serial was sold.
* `warranty_expiration_date` (DATE) - Expiration timeline calculated upon sale.

### D. Multi-Currency & Rate Ledger (`res_currency` & `res_currency_rate`)
Controls dynamic pricing based on currency fluctuation.

* `id` (Primary Key)
* `name` (VARCHAR) - Currency code (`EGP`, `USD`).
* `rate` (DECIMAL) - Exchange rate relative to base currency.
* `date` (TIMESTAMP) - Timestamp of rate update.

### E. B2B Tiered Pricelist Entity (`product_pricelist` & `product_pricelist_item`)
Manages bulk purchase rules and customer group discounts.

* `id` (Primary Key)
* `pricelist_id` (Foreign Key -> `product_pricelist`) - e.g., "Educational Tier", "SME Wholesale".
* `min_quantity` (INT) - Minimum threshold (e.g., 10+ units).
* `discount_percent` (DECIMAL) - Automated discount percentage.

### F. Sales & Dropship Purchase Ledger (`sale_order` & `purchase_order`)
Connects retail customer checkout with dropship vendor dispatch.

* `id` (Primary Key)
* `name` (VARCHAR) - Order reference (e.g., SO-2026-1001).
* `partner_id` (Foreign Key -> `res_partner`).
* `is_dropship` (BOOLEAN) - Trigger flag for auto-creating a Purchase Order (`purchase_order`).
* `payment_hash_hedera` (VARCHAR) - Cryptographic hash stamped on Hedera for immutable accounting.

---

## 3. Entity Relationship Matrix & Cardinalities

| Source Entity | Cardinality | Target Entity | Relationship Context |
| :--- | :---: | :--- | :--- |
| `product_product` | **$1 : N$** | `stock_lot` | One product variant has many unique individual Serial Numbers. |
| `res_partner` | **$1 : N$** | `product_pricelist` | Partners (B2B/B2C) are assigned specific pricing tiers. |
| `sale_order` | **$1 : N$** | `stock_lot` | An order assigns specific Serial Numbers to a customer. |
| `sale_order` | **$1 : 1$** | `purchase_order` | A dropshipped sale auto-triggers one supplier purchase order. |
| `res_currency` | **$1 : N$** | `res_currency_rate` | One currency tracks historical exchange rates over time. |

---

## 4. Extended Draw.io ERD Diagram Rules

When drawing the ERD on **Draw.io**:
1. **Color Coding:**
   * **Core Commerce:** Blue tables (`sale_order`, `res_partner`).
   * **Inventory & Serials:** Green tables (`product_template`, `stock_lot`).
   * **FinOps & Currency:** Yellow tables (`res_currency`, `product_pricelist`).
2. **Serial Number Flow:** Draw a $1:N$ connection from `product_product` to `stock_lot`, and a $1:N$ optional relation from `stock_lot` to `sale_order` to visually demonstrate how individual S/Ns attach to customer invoices.
3. **Compatibility Hub:** Group hardware attributes inside `product_template` to indicate how the future PC Builder engine will query the schema.
