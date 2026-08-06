# Use Cases Document (UC) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Purpose
This document outlines the detailed use cases for the **Elitedom Store** platform. It describes the interactions between system actors (Customers, B2B Clients, Admin Staff, Warehouse Operators, and Odoo ERP) and the system functionality required to fulfill core business goals.

---

## 2. Actors Definition
- **Customer (CUST):** Standard end-user browsing products, placing orders, and requesting support.
- **B2B Client (B2BC):** Verified institutional customer placing bulk orders or requesting customized quotes.
- **Support Agent (SUPP):** Customer service staff managing inquiries, returns, and ticket escalations.
- **Warehouse Operator (WHOP):** Staff handling local stock picking, packing, shipping, and physical inventory.
- **System Administrator (SYSA):** Technical user managing users, system configurations, and permissions.
- **Odoo ERP / Middleware (ERP):** External/Integrated enterprise resource planning engine synchronizing inventory, orders, and financial data.

---

## 3. Detailed Use Cases

### UC-01: User Registration & Authentication
- **ID:** UC-01
- **Primary Actor:** Customer / B2B Client
- **Preconditions:** The user does not have an active account or is logged out.
- **Trigger:** User clicks "Register" or "Login" on the storefront.
- **Main Flow:**
  1. User navigates to the authentication page and chooses to register or log in.
  2. For registration, the user enters email, mobile number, and secure password (or uses Google/Apple SSO).
  3. The system validates input data, creates the user record with the `Customer` role, and sends a verification notification.
  4. For login, the system verifies credentials against stored password hashes or token providers.
  5. The system issues a secure JWT session token and redirects the user to their account dashboard.
- **Alternative Flows / Exceptions:**
  - *Invalid Credentials:* The system displays an error message and prompts the user to retry or reset their password.
  - *Duplicate Email:* The system notifies the user that an account with that email already exists.
- **Postconditions:** User is authenticated and session is active.

---

### UC-02: Intelligent Product Search & Filtering
- **ID:** UC-02
- **Primary Actor:** Customer / B2B Client
- **Preconditions:** Catalog database is populated and synchronized with Odoo ERP.
- **Trigger:** User enters a search query or applies filters on the category page.
- **Main Flow:**
  1. User types keywords into the search bar or selects filters (brand, price range, RAM, processor type).
  2. The system queries **Algolia** for matching products with typo-tolerance.
  3. The search engine returns matching items with real-time stock and pricing status.
  4. The UI renders the filtered product list dynamically without full page reload.
- **Alternative Flows / Exceptions:**
  - *No Results Found:* The system displays a "No products found" message with recommended alternative categories or popular items.
- **Postconditions:** User views relevant product listings matching their criteria.

---

### UC-03: Order Placement & Checkout Process
- **ID:** UC-03
- **Primary Actor:** Customer
- **Preconditions:** User has added items to the shopping cart.
- **Trigger:** User clicks "Proceed to Checkout".
- **Main Flow:**
  1. User reviews shopping cart contents and applies any valid loyalty points or discount codes.
  2. User enters or selects a saved shipping address within Egypt governorates.
  3. System calculates applicable shipping fees and taxes based on location.
  4. User selects a payment method (Online Credit Card, Mobile Wallet, or Cash on Delivery).
  5. User confirms and places the order.
  6. The system generates a unique Order Number, deducts temporary stock, and triggers the Odoo ERP synchronization event.
  7. The system sends an order confirmation email/SMS to the customer.
- **Alternative Flows / Exceptions:**
  - *Payment Gateway Failure:* The system prompts the user to retry payment or select an alternative payment method without clearing the cart.
  - *Out of Stock during Checkout:* The system alerts the user regarding stock unavailability and prompts cart adjustment.
- **Postconditions:** Order is successfully logged, confirmation is dispatched, and order state is set to `Pending Payment` or `Payment Confirmed`.

---

### UC-04: Hybrid Stock & Dropshipping Fulfillment Routing
- **ID:** UC-04
- **Primary Actor:** System / Odoo ERP Middleware
- **Preconditions:** Order has been confirmed and paid or authorized for fulfillment.
- **Trigger:** Order lifecycle transitions to `Processing / Packing`.
- **Main Flow:**
  1. The system evaluates item availability across local physical warehouse stock and dropshipping supplier feeds.
  2. For items in **Local Stock**, the system routes a picking list to the warehouse operator's dashboard.
  3. For items designated as **Dropshipping**, the system automatically generates a digital Purchase Order (PO) and transmits fulfillment instructions to the verified supplier via API or automated email.
  4. Warehouse operator picks and packs local items, printing shipping labels.
  5. Tracking numbers from local courier and dropship suppliers are updated in the system.
- **Alternative Flows / Exceptions:**
  - *Supplier Out of Stock:* System alerts procurement team and flags order item for customer service intervention.
- **Postconditions:** Fulfillment workflow is initialized across local and dropship channels.

---

### UC-05: Warranty & RMA (Return Merchandise Authorization) Request
- **ID:** UC-05
- **Primary Actor:** Customer & Support Agent
- **Preconditions:** Customer has a delivered order within the active warranty period.
- **Trigger:** Customer navigates to "My Orders" and selects "Request Return / Warranty".
- **Main Flow:**
  1. Customer selects the item, specifies the return reason (Defective, Wrong Item, Damaged), and uploads photo/video evidence.
  2. The system validates warranty eligibility based on purchase date and category rules (Level 1 Automation).
  3. The system creates an RMA ticket and assigns a unique RMA tracking code.
  4. A Customer Support Agent or Technical Inspector reviews the claim details in the admin dashboard (Level 2 Audit).
  5. Agent approves or rejects the RMA request and issues pickup instructions or replacement status.
- **Alternative Flows / Exceptions:**
  - *Warranty Expired:* System automatically rejects the RMA request and displays policy terms.
- **Postconditions:** RMA ticket is logged and lifecycle status is updated.

---

### UC-06: B2B Bulk Quotation Request (RFQ)
- **ID:** UC-06
- **Primary Actor:** B2B Client & Sales Officer
- **Preconditions:** User is logged in with a verified B2B account role.
- **Trigger:** B2B client navigates to the institutional portal and clicks "Request Custom Quote".
- **Main Flow:**
  1. Client adds bulk quantities of hardware/equipment to a quotation list.
  2. Client submits project details, notes, and requested delivery timeline.
  3. The system generates an RFQ record and notifies the sales and finance teams.
  4. Sales officer reviews the request, applies tiered corporate pricing, and issues an official quotation proposal.
  5. Client reviews the proposal on their dashboard and accepts or negotiates terms.
  6. Upon acceptance, the system converts the quote into a confirmed B2B sales order linked to Odoo ERP.
- **Alternative Flows / Exceptions:**
  - *Quote Rejected/Expired:* Quote status transitions to closed.
- **Postconditions:** B2B quotation is processed and converted or archived.

---
**End of Document**
