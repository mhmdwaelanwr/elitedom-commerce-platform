# Functional Requirements Document (FRD) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Purpose
This document defines the functional requirements for the **Elitedom Store** platform. It translates the business objectives and high-level requirements outlined in the Business Requirements Document (BRD v2.1) into specific system behaviors, user interactions, and functional modules necessary for software development and system architecture design.

---

## 2. Functional Modules Overview

1. **Module 1: User Authentication & Account Management (AUTH)**
2. **Module 2: Product Catalog & Intelligent Search (CAT)**
3. **Module 3: Shopping Cart & Checkout Engine (CART)**
4. **Module 4: Order Lifecycle & Fulfillment Management (ORD)**
5. **Module 5: Inventory & Hybrid Stock/Dropshipping Synchronization (INV)**
6. **Module 6: Supplier & Procurement Management (SUP)**
7. **Module 7: Warranty & RMA (Return Merchandise Authorization) Management (RMA)**
8. **Module 8: Loyalty Program & Customer Rewards (LOY)**
9. **Module 9: B2B Quotation & Institutional Sales Portal (B2B)**
10. **Module 10: Reporting, Analytics & Admin Dashboards (REP)**
11. **Module 11: ERP Integration & Middleware Engine (ERP)**

---

## 3. Detailed Functional Requirements

### Module 1: User Authentication & Account Management (AUTH)
- **FR-AUTH-001:** The system shall allow new users to register using a valid email address, password, and mobile number.
- **FR-AUTH-002:** The system shall support user login via email/password and secure social authentication providers (Google/Apple).
- **FR-AUTH-003:** The system shall enforce Role-Based Access Control (RBAC) supporting roles: `Customer`, `B2B Client`, `Customer Support Agent`, `Warehouse Operator`, `Inventory Manager`, `Finance Officer`, and `System Administrator`.
- **FR-AUTH-004:** Users shall be able to manage multiple shipping addresses, personal details, and view their order history within their account dashboard.

### Module 2: Product Catalog & Intelligent Search (CAT)
- **FR-CAT-001:** The system shall display products organized in a multi-level hierarchical category tree (e.g., Processors, GPUs, Laptops, Accessories).
- **FR-CAT-002:** The system shall integrate with **Algolia** to provide real-time, typo-tolerant search filtering by brand, price range, stock status, ratings, and technical specifications.
- **FR-CAT-003:** The system shall display detailed product pages featuring high-resolution image galleries, specifications tables, warranty terms, and stock/dropshipping availability status.
- **FR-CAT-004:** The admin dashboard shall allow authorized staff to create, update, disable, or delete product listings and synchronize stock levels automatically with Odoo ERP.

### Module 3: Shopping Cart & Checkout Engine (CART)
- **FR-CART-001:** The system shall allow both guest users and registered customers to add products to a persistent shopping cart.
- **FR-CART-002:** The system shall support a streamlined checkout process collecting shipping address, delivery method, and payment method.
- **FR-CART-003:** The system shall support secure online payment gateways (Credit Card, Mobile Wallets) as well as Cash on Delivery (COD) subject to verification rules.
- **FR-CART-004:** The system shall calculate applicable shipping fees and taxes automatically based on the delivery governorate in Egypt.

### Module 4: Order Lifecycle & Fulfillment Management (ORD)
- **FR-ORD-001:** Upon successful order placement, the system shall generate a unique Order Number and trigger an order creation event in Odoo ERP.
- **FR-ORD-002:** The system shall manage order status transitions: `Pending Payment`, `Payment Confirmed`, `Processing / Packing`, `Shipped`, `Delivered`, `Cancelled`, and `Returned`.
- **FR-ORD-003:** The system shall automatically send notification emails/SMS to customers at key order lifecycle milestones.
- **FR-ORD-004:** Authorized warehouse staff shall be able to generate packing slips, shipping labels, and branded tax invoices directly from the admin panel.

### Module 5: Inventory & Hybrid Stock/Dropshipping Synchronization (INV)
- **FR-INV-001:** The system shall support dual fulfillment models: **Local Stock** (physical warehouse) and **Dropshipping** (verified supplier fulfillment).
- **FR-INV-002:** The inventory engine shall synchronize stock levels in real time with Odoo ERP to prevent overselling.
- **FR-INV-003:** When an item is out of stock in the physical warehouse but marked as dropship-enabled, the system shall automatically route the purchase order details to the designated supplier.

### Module 6: Supplier & Procurement Management (SUP)
- **FR-SUP-001:** The system shall maintain a secure database of verified suppliers, including contact info, product catalogues, lead times, and performance metrics.
- **FR-SUP-002:** The procurement module shall allow generation of Purchase Orders (POs) sent to suppliers when local inventory hits predefined safety stock thresholds.
- **FR-SUP-003:** The system shall track supplier delivery performance and item defect rates to generate periodic evaluation reports.

### Module 7: Warranty & RMA Management (RMA)
- **FR-RMA-001:** The system shall provide a digital customer portal allowing users to submit Return Merchandise Authorization (RMA) requests with photo/video proof and order references.
- **FR-RMA-002:** **Level 1 (Automated Intake):** The system shall log the RMA ticket in the Helpdesk module and validate warranty eligibility based on purchase date and category rules.
- **FR-RMA-003:** **Level 2 (Human Audit):** Customer service agents or technical inspectors shall review, approve, reject, or request further information on RMA claims via the admin dashboard.
- **FR-RMA-004:** The system shall issue a unique RMA tracking reference and update the customer via email/SMS throughout the inspection and repair/replacement process.

### Module 8: Loyalty Program & Customer Rewards (LOY)
- **FR-LOY-001:** The system shall automatically award loyalty points to registered customers upon the successful completion and payment of an order.
- **FR-LOY-002:** Customers shall be able to view their accumulated loyalty points balance and redemption history in their account profile.
- **FR-LOY-003:** The system shall allow customers to apply loyalty points at checkout to receive discounts on future purchases according to active loyalty policies.

### Module 9: B2B Quotation & Institutional Sales Portal (B2B)
- **FR-B2B-001:** Verified institutional customers (SMEs, schools, labs) shall be able to submit bulk quotation requests (`Request for Quote - RFQ`) through a dedicated B2B portal.
- **FR-B2B-002:** Sales and Finance teams shall review RFQs and issue customized tiered pricing proposals back to the client account.
- **FR-B2B-003:** Approved B2B quotes shall be convertible into official sales orders and invoices within Odoo ERP.

### Module 10: Reporting, Analytics & Admin Dashboards (REP)
- **FR-REP-001:** The system shall provide comprehensive analytics dashboards for administrators displaying total revenue, order volume, best-selling products, and customer acquisition metrics.
- **FR-REP-002:** The system shall generate exportable reports for Sales, Finance, Inventory Valuation, Supplier Performance, and Warranty/RMA trends in CSV and PDF formats.

### Module 11: ERP Integration & Middleware Engine (ERP)
- **FR-ERP-001:** The system shall maintain bi-directional API synchronization with Odoo ERP for products, pricing, inventory levels, customers, and invoices.
- **FR-ERP-002:** In the event of API connectivity failure, the middleware shall queue transactions locally and retry synchronization automatically upon connection restoration.

---

## 4. Non-Functional Constraints & Traceability
All functional modules must comply with the Non-Functional Requirements (NFR) and security policies, ensuring role-based access control, GDPR/Egyptian data protection compliance, and high availability (≥ 99.5% uptime).

---
**End of Document**
