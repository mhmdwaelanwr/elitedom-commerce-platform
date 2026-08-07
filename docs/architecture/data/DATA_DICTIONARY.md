# Data Dictionary Document - Elitedom Store

**Document Classification:** Internal  
**Version:** 3.0  
**Status:** Approved / Production Ready  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (PostgreSQL 15)  

---

## 1. Introduction & Purpose
This Data Dictionary defines the database schema entities, field definitions, data types, constraints, and relationships supporting the **Elitedom Store** e-commerce platform and its underlying **Odoo 17 ERP** integration. It serves as the single source of truth for backend developers, database administrators, and system architects, ensuring strict traceability for high-value hardware, multi-currency pricing, and automated fulfillment.

---

## 2. Core Entity Relationship Overview
- **Users & Partners (`res.partner`, `res.users`):** Centralizes customer profiles, B2B corporate clients, staff, suppliers, and mobile app tokens.
- **Product Catalog & Compatibility (`product.template`, `product.product`, `product.public.category`):** Manages hardware items, hierarchical categories, and PC Builder technical attributes.
- **Pricing & Multi-Currency (`product.pricelist`, `product.pricelist.item`, `res.currency`, `res.currency.rate`):** Manages B2B tier pricing, margin rules, and real-time exchange rates.
- **Inventory & Serial Tracking (`stock.warehouse`, `stock.picking`, `stock.move`, `stock.lot`):** Handles warehouse logistics, multi-location stock, and unique Serial Number (S/N) tracking for warranties.
- **Sales & Checkout (`sale.order`, `sale.order.line`, `purchase.order`):** Handles shopping carts, checkouts, and automated dropshipping purchase orders.
- **Service & After-Sales (`elitedom.rma.ticket`, `elitedom.b2b.rfq`, `elitedom.loyalty.ledger`, `elitedom.hedera.audit`):** Manages warranty claims, institutional RFQs, reward points, and Web3 immutability hashes.

---

## 3. Detailed Data Models & Schema Definitions

### 3.1. Users, Partners & App Tokens (`res.partner`)
Represents all system actors including retail customers, B2B institutional buyers, warehouse staff, and suppliers.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the partner record. |
| `name` | Varchar(128) | Not Null | Full name or company legal name. |
| `company_type` | Varchar(32) | Default: 'person' | Entity type (`person` for B2C, `company` for B2B). |
| `email` | Varchar(128) | Unique, Index, Not Null | Primary email address used for login and notifications. |
| `phone` | Varchar(20) | Not Null, Index | Egyptian mobile number formatted for SMS notifications (Twilio). |
| `pricelist_id` | Integer | Foreign Key (`product.pricelist.id`), Nullable | Assigned price tier (Standard Retail vs. B2B Corporate). |
| `is_dropship_vendor` | Boolean | Default: False | Flag for third-party dropship suppliers. |
| `mobile_fcm_token` | Varchar(255) | Nullable | Push notification token for future Mobile App integration. |
| `governorate` | Varchar(64) | Nullable | Egyptian delivery governorate for shipping calculation. |
| `street_address` | Text | Nullable | Detailed residential or corporate street address. |
| `created_at` | Timestamp | Default: CURRENT_TIMESTAMP | Timestamp when the user account was created. |

---

### 3.2. Hardware Product Catalog & Compatibility Matrix (`product.template` & `product.product`)
Stores product master data along with technical hardware compatibility parameters for future PC Builder engines.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the product template. |
| `name` | Varchar(255) | Not Null, Index | Hardware display name (e.g., Intel Core i7-14700K, ASUS RTX 4070). |
| `sku` | Varchar(64) | Unique, Not Null, Index | Stock Keeping Unit code synchronized with Odoo ERP. |
| `tracking` | Varchar(32) | Default: 'serial' | Inventory tracking mode (`serial` for S/N tracking, `barcode` for standard items). |
| `base_cost_usd` | Decimal(10,2) | Not Null | Sourcing cost in foreign currency. |
| `target_margin_percent` | Decimal(5,2) | Not Null | Profit margin applied to cost. |
| `list_price` | Decimal(10,2) | Not Null | Final computed retail selling price in EGP. |
| `category_id` | Integer | Foreign Key (`product.public.category.id`) | Associated public category in the multi-level tree. |
| `is_dropship_enabled`| Boolean | Default: False | Flag indicating if out-of-stock items route to automated dropship POs. |
| **Compatibility Matrix Fields:** | | | |
| `socket_type` | Varchar(32) | Nullable | Motherboard/CPU socket type (e.g., `LGA1700`, `AM5`). |
| `ram_type` | Varchar(32) | Nullable | Supported RAM memory type (e.g., `DDR4`, `DDR5`). |
| `form_factor` | Varchar(32) | Nullable | Case/Motherboard form factor (e.g., `ATX`, `Micro-ATX`, `ITX`). |
| `power_wattage_draw`| Integer | Default: 0 | Power consumption requirement in Watts. |
| `pcie_gen` | Varchar(32) | Nullable | PCI Express generation slot (e.g., `PCIe 4.0 x16`, `PCIe 5.0`). |

---

### 3.3. Unique Serial Number Tracking (`stock.lot`)
Ensures full auditability and handles item-level warranty claims for high-value hardware.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the serial lot record. |
| `name` | Varchar(128) | Unique, Index, Not Null | Physical Serial Number (S/N) scanned at intake. |
| `product_id` | Integer | Foreign Key (`product.product.id`), Not Null | Associated hardware item variant. |
| `sale_order_id` | Integer | Foreign Key (`sale.order.id`), Nullable | Sales order through which the serial was sold to the customer. |
| `warranty_expiration_date`| Date | Nullable | Expiration timeline calculated automatically upon sale date. |

---

### 3.4. Multi-Currency & Rate Ledger (`res.currency` & `res.currency.rate`)
Controls dynamic pricing based on foreign currency fluctuations against EGP.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique currency record identifier. |
| `name` | Varchar(8) | Unique, Not Null | Currency code (`EGP`, `USD`). |
| `rate` | Decimal(12,6) | Not Null | Exchange rate relative to the base company currency. |
| `date` | Timestamp | Default: CURRENT_TIMESTAMP | Timestamp of the rate update. |

---

### 3.5. B2B Tiered Pricelists (`product.pricelist` & `product.pricelist.item`)
Manages bulk purchase rules, corporate discounts, and educational pricing tiers.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the pricelist rule. |
| `pricelist_id` | Integer | Foreign Key (`product.pricelist.id`), Not Null | Parent pricelist name (e.g., "Educational Tier", "SME Wholesale"). |
| `min_quantity` | Integer | Default: 1 | Minimum quantity threshold to trigger discount (e.g., 10+ units). |
| `discount_percent` | Decimal(5,2) | Not Null | Automated discount percentage applied to base price. |

---

### 3.6. Sales & Checkout Orders (`sale.order` & `sale.order.line`)
Manages shopping carts, persistent sessions, checkout transactions, and order states synced with Odoo.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique internal identifier for the order. |
| `name` | Varchar(64) | Unique, Not Null | Public Order Number (e.g., SO2026-00142). |
| `partner_id` | Integer | Foreign Key (`res.partner.id`), Not Null | Customer who placed the order. |
| `state` | Varchar(32) | Not Null, Default: 'draft' | Order lifecycle state (`draft`, `sent`, `sale`, `done`, `cancel`). |
| `payment_method` | Varchar(32) | Not Null | Selected payment mode (`credit_card`, `mobile_wallet`, `cod`). |
| `payment_status` | Varchar(32) | Not Null, Default: 'pending' | Gateway settlement status (`pending`, `paid`, `failed`, `refunded`). |
| `amount_total` | Decimal(10,2) | Not Null | Total order amount inclusive of shipping and taxes. |
| `odoo_order_id` | Integer | Nullable, Index | Corresponding order ID inside the Odoo ERP database. |
| `shipping_address` | Text | Not Null | Snapshot of the delivery address at checkout time. |

---

### 3.7. Inventory & Fulfillment (`stock.picking` & `stock.move`)
Handles warehouse picking slips, delivery dispatch, and dropshipping fulfillment routing.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the picking operation. |
| `name` | Varchar(64) | Unique, Not Null | Reference code for the warehouse transfer or picking slip. |
| `sale_id` | Integer | Foreign Key (`sale.order.id`) | Associated customer sales order. |
| `picking_type` | Varchar(32) | Not Null | Operation type (`incoming`, `outgoing`, `internal`, `dropship`). |
| `state` | Varchar(32) | Not Null, Default: 'draft' | Fulfillment status (`draft`, `waiting`, `confirmed`, `assigned`, `done`). |
| `courier_tracking_ref`| Varchar(128)| Nullable | External shipping courier tracking number. |
| `supplier_po_ref` | Varchar(64) | Nullable | Associated Purchase Order number sent to dropship suppliers. |

---

### 3.8. Warranty & RMA Management (`elitedom.rma.ticket`)
Tracks customer return merchandise authorization and hardware warranty claims.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the RMA ticket. |
| `ticket_number` | Varchar(64) | Unique, Not Null | Public RMA reference code (e.g., RMA-2026-891). |
| `partner_id` | Integer | Foreign Key (`res.partner.id`), Not Null | Customer requesting the warranty service. |
| `order_id` | Integer | Foreign Key (`sale.order.id`), Not Null | Original sales order containing the defective item. |
| `reason` | Text | Not Null | Detailed description of the hardware defect or return reason. |
| `evidence_media_url`| Varchar(512)| Nullable | Secure storage URL for attached photo/video proof. |
| `status` | Varchar(32) | Default: 'pending_review' | Workflow status (`pending_review`, `approved`, `rejected`, `completed`). |

---

### 3.9. B2B Quotations & RFQ (`elitedom.b2b.rfq`)
Manages institutional and bulk hardware purchase requests.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique identifier for the B2B RFQ. |
| `rfq_code` | Varchar(64) | Unique, Not Null | Reference number for the bulk quotation request. |
| `partner_id` | Integer | Foreign Key (`res.partner.id`), Not Null | Verified B2B institutional client. |
| `items_payload` | JSON | Not Null | Structured JSON payload of requested bulk items and quantities. |
| `status` | Varchar(32) | Default: 'submitted' | RFQ status (`submitted`, `under_review`, `quoted`, `accepted`, `declined`). |
| `validity_date` | Date | Nullable | Expiration date for custom corporate pricing proposals. |

---

### 3.10. Loyalty Program Ledger (`elitedom.loyalty.ledger`)
Tracks reward points accumulation and redemption for loyal customers.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique ledger entry identifier. |
| `partner_id` | Integer | Foreign Key (`res.partner.id`), Not Null | Customer owning the loyalty points. |
| `points_delta` | Integer | Not Null | Number of points earned (positive) or redeemed (negative). |
| `transaction_type` | Varchar(32) | Not Null | Action type (`purchase_earn`, `order_redemption`, `admin_adjustment`). |
| `reference_order_id`| Integer | Foreign Key (`sale.order.id`), Nullable | Associated sales order tied to the points movement. |

---

### 3.11. Web3 Audit & Hedera Immutable Ledger (`elitedom.hedera.audit`)
Hashes payment transaction records onto the Hedera network for tamper-proof verification.

| Field Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment | Unique audit log entry ID. |
| `transaction_ref` | Varchar(128) | Not Null, Index | Internal payment transaction reference. |
| `payload_hash` | Varchar(256) | Not Null | SHA-256 cryptographic hash of the receipt and payment details. |
| `hedera_tx_id` | Varchar(128) | Unique, Not Null | Immutable transaction ID returned by the Hedera Consensus Service. |
| `timestamp` | Timestamp | Default: CURRENT_TIMESTAMP | Exact time the hash was anchored to the blockchain. |

---
**End of Document**
