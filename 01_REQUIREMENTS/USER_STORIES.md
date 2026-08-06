# User Stories Document (US) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Purpose
This document translates the functional requirements and use cases into agile **User Stories** for the **Elitedom Store** platform. Each story follows the standard user story format (`As a... I want to... So that...`) and includes clear Acceptance Criteria (AC) to guide development and QA testing sprints.

---

## 2. Epic Breakdown
1. **Epic 1: User Authentication & Account Management (EP-01)**
2. **Epic 2: Product Catalog & Intelligent Search (EP-02)**
3. **Epic 3: Shopping Cart & Checkout Engine (EP-03)**
4. **Epic 4: Order Lifecycle & Fulfillment Management (EP-04)**
5. **Epic 5: Inventory & Hybrid Stock/Dropshipping Synchronization (EP-05)**
6. **Epic 6: Warranty & RMA Management (EP-06)**
7. **Epic 7: B2B Quotation & Institutional Sales Portal (EP-07)**
8. **Epic 8: Loyalty Program & Rewards (EP-08)**

---

## 3. Detailed User Stories

### Epic 1: User Authentication & Account Management (EP-01)

#### US-101: Customer Registration
- **As a** new visitor,
- **I want to** register for an account using my email, mobile number, and password,
- **So that** I can track my orders, save shipping addresses, and earn loyalty points.
- **Acceptance Criteria:**
  1. The registration form validates valid email formats, Egyptian mobile numbers, and password complexity (min 8 chars, numbers, and symbols).
  2. Upon successful submission, a verification email/SMS is sent to the user.
  3. A user record is created in the database with the default role `Customer`.

#### US-102: Social Login (Google / Apple)
- **As a** shopper,
- **I want to** log in quickly using my Google or Apple account,
- **So that** I don't have to remember another set of credentials.
- **Acceptance Criteria:**
  1. Login page displays "Sign in with Google" and "Sign in with Apple" buttons.
  2. Successful OAuth authentication retrieves user profile data and logs them into the storefront instantly.
  3. If the email already exists via standard registration, accounts are automatically linked.

---

### Epic 2: Product Catalog & Intelligent Search (EP-02)

#### US-201: Multi-Level Category Navigation
- **As a** hardware shopper,
- **I want to** browse products through a structured category tree (e.g., PC Components -> Processors -> Intel),
- **So that** I can easily find the specific parts I need for my build.
- **Acceptance Criteria:**
  1. Header navigation displays main categories and subcategories dynamically.
  2. Selecting a category loads the associated product grid with pagination.
  3. Category breadcrumbs are displayed for easy navigation backward.

#### US-202: Advanced Filter & Typo-Tolerant Search
- **As a** customer looking for specific computer parts,
- **I want to** search for items by name or keywords and filter results by brand, price range, and technical specs,
- **So that** I can narrow down options matching my budget and requirements quickly.
- **Acceptance Criteria:**
  1. Search bar powered by **Algolia** returns results within 300ms.
  2. Typo-tolerance handles minor spelling mistakes (e.g., "procsor" returns "processor").
  3. Dynamic facet filters update product counts instantly as checkboxes are selected.

---

### Epic 3: Shopping Cart & Checkout Engine (EP-03)

#### US-301: Persistent Shopping Cart
- **As a** registered customer,
- **I want** items added to my cart to be saved across browser sessions and devices,
- **So that** I can resume my purchase later without re-selecting products.
- **Acceptance Criteria:**
  1. Cart items for logged-in users are stored in the database tied to their user ID.
  2. Guest cart items are stored in local storage and merged into the user account upon login.
  3. Cart drawer or page displays item quantities, unit prices, subtotal, and stock alerts.

#### US-302: Secure Checkout & Payment Selection
- **As a** buyer completing an order,
- **I want to** select my shipping address, delivery governorate, and payment method (Credit Card, Mobile Wallet, or Cash on Delivery),
- **So that** I can finalize my purchase securely.
- **Acceptance Criteria:**
  1. Checkout flow collects and validates Egyptian governorates and delivery address details.
  2. Payment gateway integration processes credit cards and mobile wallets securely (PCI-DSS compliant).
  3. Cash on Delivery (COD) is available based on order value limits and user verification history.

---

### Epic 4: Order Lifecycle & Fulfillment Management (EP-04)

#### US-401: Order Confirmation & ERP Synchronization
- **As a** customer,
- **I want to** receive an order confirmation with a unique Order Number via email/SMS after checkout,
- **So that** I have proof of purchase and can track my delivery.
- **Acceptance Criteria:**
  1. Successful checkout triggers an automated confirmation email and SMS containing order details and tracking link.
  2. An order creation payload is transmitted instantly to Odoo ERP.
  3. Order initial status is set to `Pending Payment` (for online gateway) or `Payment Confirmed` (for COD).

#### US-402: Warehouse Packing & Shipping Management
- **As a** warehouse operator,
- **I want to** view paid orders on my dashboard and generate packing slips and shipping labels,
- **So that** I can fulfill and dispatch orders efficiently.
- **Acceptance Criteria:**
  1. Admin panel displays orders filtered by fulfillment status (`Processing / Packing`).
  2. Operator can click "Print Packing Slip" and "Generate Courier Shipping Label".
  3. Updating status to `Shipped` logs the courier tracking number and notifies the customer.

---

### Epic 5: Inventory & Hybrid Stock/Dropshipping Synchronization (EP-05)

#### US-501: Real-Time Stock Synchronization with Odoo ERP
- **As an** inventory manager,
- **I want** product stock levels on the website to synchronize automatically with Odoo ERP,
- **So that** customers cannot purchase items that are out of stock.
- **Acceptance Criteria:**
  1. Bi-directional API webhooks update storefront stock quantities when inventory changes in Odoo ERP.
  2. When local stock reaches 0, the item button changes to "Out of Stock" or switches to "Dropship Available" if enabled.

#### US-502: Automated Dropshipping Purchase Order Routing
- **As a** system administrator,
- **I want** the system to automatically generate and send Purchase Orders to verified suppliers for out-of-stock items marked as dropship-enabled,
- **So that** third-party fulfillment is initiated without manual intervention.
- **Acceptance Criteria:**
  1. When an order contains a dropship item, the system checks supplier catalog rules.
  2. A digital PO is transmitted to the supplier via API or email containing product SKU and shipping destination.

---

### Epic 6: Warranty & RMA Management (EP-06)

#### US-601: Digital RMA & Warranty Request Submission
- **As a** customer with a defective product,
- **I want to** submit a Return Merchandise Authorization (RMA) request from my account dashboard by uploading photos and order details,
- **So that** I can initiate a warranty claim or return.
- **Acceptance Criteria:**
  1. Customer selects a delivered order item, specifies the return reason, and attaches photo/video proof.
  2. System validates warranty eligibility based on purchase date and category policy (Level 1 Automation).
  3. System generates an RMA ticket number and updates status to `Pending Review`.

#### US-602: RMA Review & Approval Workflow
- **As a** customer support agent,
- **I want to** review submitted RMA claims, inspect proof evidence, and approve or reject requests,
- **So that** returns and replacements are processed according to company policy.
- **Acceptance Criteria:**
  1. Support dashboard lists incoming RMA tickets with customer details and attached media.
  2. Agent can approve the claim (generating return shipping instructions) or reject it with comments.
  3. Customer receives automated email/SMS updates at each RMA status change.

---

### Epic 7: B2B Quotation & Institutional Sales Portal (EP-07)

#### US-701: B2B Bulk Quotation Request (RFQ)
- **As a** verified B2B client (school, lab, corporate buyer),
- **I want to** submit a bulk Request for Quote (RFQ) for multiple hardware items,
- **So that** I can receive tiered institutional pricing.
- **Acceptance Criteria:**
  1. B2B portal allows adding bulk quantities to a quotation cart and submitting project notes.
  2. System creates an RFQ record and notifies sales and finance teams.

#### US-702: Sales Quote Proposal & Conversion
- **As a** sales officer,
- **I want to** review B2B RFQs, apply custom corporate discounts, and send official proposals back to the client,
- **So that** institutional sales can be closed and converted into Odoo orders.
- **Acceptance Criteria:**
  1. Sales dashboard enables editing item pricing and adding terms/validity dates.
  2. Client can view the proposal on their dashboard and click "Accept Quote".
  3. Accepting the quote converts it into an official sales order synced with Odoo ERP.

---

### Epic 8: Loyalty Program & Rewards (EP-08)

#### US-801: Loyalty Points Accumulation & Redemption
- **As a** loyal customer,
- **I want to** earn reward points on my purchases and apply them as discounts on future orders,
- **So that** I receive financial benefits for my continued patronage.
- **Acceptance Criteria:**
  1. System calculates and awards points upon successful order completion and payment.
  2. Customer profile displays current point balance and redemption history.
  3. Checkout screen allows applying points to reduce the order total based on active loyalty conversion rates.

---
**End of Document**
