# Software Test Cases & Execution Matrix (TEST_CASES.md)

**Document Classification:** Internal / Quality Assurance & Testing  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Executive Summary & Overview
This document defines the structured test case execution matrix for the **Elitedom Store** e-commerce platform. It maps functional requirements and user stories to concrete test scenarios, expected results, and verification steps across authentication, product discovery, checkout, inventory synchronization, and RMA support.

---

## 2. Test Case Execution Matrix

| Test ID | Module / Feature | Test Scenario & Description | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Authentication | User registration with valid Egyptian mobile number and strong password. | Account created successfully; JWT token stored in secure HTTP-only cookie; redirect to dashboard. | Pass |
| **TC-AUTH-02** | Authentication | Attempt login with incorrect password / unregistered email. | Inline error banner (`#DC2626`) displayed; login blocked; rate-limiting triggered after 5 failed attempts. | Pass |
| **TC-PROD-01** | Product Catalog | Search for hardware keyword (e.g., "RTX 5090") via Algolia search bar. | Matching product cards rendered in under 300ms with accurate pricing in `EGP`. | Pass |
| **TC-PROD-02** | Inventory Sync | Verify live stock count update on Product Detail Page (PDP). | Stock count matches real-time Odoo 17 inventory module (e.g., "In Stock - 2 Units Left"). | Pass |
| **TC-CART-01** | Cart Management | Add item to cart from product grid (`[ Quick Add ]` or `[ Add to Cart ]`). | Cart badge increments counter instantly (e.g., `Cart (3)`); success toast notification (`#16A34A`) displayed. | Pass |
| **TC-CART-02** | Guest Merging | Add items to cart as guest, then log in to existing account. | Guest cart items successfully merged into user account cart without data loss. | Pass |
| **TC-CHK-01` | Secure Checkout | Proceed to checkout with valid shipping details (Cairo, El Matareya). | Subtotal, shipping (EGP 150), and 14% VAT calculated correctly in order summary. | Pass |
| **TC-CHK-02` | Payment Gateway | Complete payment via Credit Card / Cash on Delivery (COD). | Order created in Odoo 17 ERP, stock decremented, serial number ($S/N$) assigned, receipt displayed. | Pass |
| **TC-ERP-01` | Odoo ERP Sync | Verify webhook delivery upon order confirmation. | Sales order payload successfully posted to Odoo 17 backend with valid `X-Elitedom-Signature`. | Pass |
| **TC-RMA-01` | RMA & Warranty | Submit warranty claim ticket with valid Hardware Serial Number ($S/N$). | Odoo Helpdesk ticket generated; confirmation message with tracking ID and SLA timeline (24-48h) shown. | Pass |
| **TC-SEC-01` | Security / RBAC | Attempt access to administrative endpoints (`/admin`) using standard customer token. | Access denied (`403 Forbidden` response); redirection to storefront home. | Pass |

---

## 3. Defect Reporting & Sign-Off Criteria
* **Defect Logging:** All failed test cases must be logged into Sentry or internal issue trackers with reproduction steps and logs.
* **Release Gate:** Zero Critical (P0) or Major (P1) defects remaining open prior to production deployment on Oracle Cloud VPS.

---
End of Document
