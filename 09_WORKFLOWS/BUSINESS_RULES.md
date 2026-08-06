# Business Rules & Validation Specification (BUSINESS_RULES.md)

**Document Classification:** Internal / Architecture & Operations  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store, Odoo 17 ERP, FastAPI Backend, PostgreSQL  

---

## 1. Executive Summary & Overview
This document defines the core business rules and validation constraints governing operations within the **Elitedom Store** e-commerce platform and its underlying **Odoo 17 ERP** core. These rules dictate automated decision-making regarding inventory allocation, pricing margins, warranty validation, dropshipping routes, and decentralized audit logging.

---

## 2. Inventory & Stock Allocation Rules
* **BR-INV-01 (Reservation Precedence):** Inventory is strictly reserved upon successful payment authorization (transition of Sales Order from `Draft` to `Confirmed`). Cart items in `Draft` status do not hold stock allocations.
* **BR-INV-02 (Negative Stock Prohibition):** Warehouse locations mapped to local hardware inventory are strictly prohibited from holding negative stock levels (`on_hand >= 0`). Odoo enforces row-level locking to block checkout transactions if remaining stock falls below ordered quantities.
* **BR-INV-03 (Serial Number Binding):** Every physical hardware item sold from local stock must have a unique Serial Number ($S/N$) scanned and bound to the corresponding Delivery Order (`stock.picking`) before validation.

---

## 3. Pricing & Margin Calculation Rules
* **BR-PRC-01 (Automated Margin Floor):** Dropship and retail product prices must maintain a minimum net profit margin threshold. If supplier price fluctuations push the net margin below 12%, Odoo automatically flags the product variant for administrative price review.
* **BR-PRC-02 (Tax & Currency Calculation):** All storefront prices displayed via FastAPI must include applicable local Egyptian sales taxes unless overridden by B2B corporate tax exemption credentials verified in Odoo.

---

## 4. Warranty & RMA Eligibility Rules
* **BR-RMA-01 (Warranty Window Validation):** RMA and warranty claims submitted via Typeform are automatically rejected if the submitted Serial Number ($S/N$) purchase date exceeds the standard 1-year hardware warranty window, unless an extended warranty SKU is linked to the original invoice.
* **BR-RMA-02 (Mandatory Media Evidence):** Every RMA submission must include verified photo or video proof detailing the hardware defect before a support ticket can transition from `Under Review` to `Approved`.

---

## 5. Dropshipping & Fulfillment Rules
* **BR-DSP-01 (Supplier Route Automation):** When an order contains a dropship-designated item, Odoo must automatically generate a Purchase Order (PO) assigned to the pre-configured external supplier upon payment confirmation.
* **BR-DSP-02 (White-Label Compliance):** External suppliers fulfilling dropship orders on behalf of Elitedom Store are strictly contractually mandated to utilize Elitedom white-label shipping labels and packaging slips.

---

## 6. Security & Ledger Audit Rules
* **BR-SEC-01 (Decentralized Hashing):** Critical transaction events (payment settlement, B2B order creation, and high-value status changes) must have their payloads securely hashed and recorded to the Hedera Consensus Service (HCS) audit topic via background Python scripts.
* **BR-SEC-02 (Log Retention & Rotation):** System audit logs stored on Oracle Cloud infrastructure must undergo automated rotation and compression every 30 days to prevent disk exhaustion and maintain system availability.

---
End of Document
