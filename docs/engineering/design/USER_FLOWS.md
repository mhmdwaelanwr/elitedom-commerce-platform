# UI/UX User Flows & Navigation Architecture (USER_FLOWS.md)

**Document Classification:** Internal / Frontend Engineering & UI/UX Design  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store Storefront, FastAPI UI, Tailwind CSS, Odoo 17 Portal  

---

## 1. Executive Summary & Overview
This document outlines the core user journey flows and interaction pathways for customers and administrative staff within the **Elitedom Store** e-commerce platform. It details step-by-step navigation sequences across the FastAPI storefront, secure checkout gateway, and Odoo 17 ERP customer portal.

---

## 2. Customer Authentication & Onboarding Flow
Defines how users register, log in, and manage their session tokens across the storefront interface.

1. **Entry Point:** User visits storefront or clicks "Sign In / Register".
2. **Action:** User enters credentials (Email & Password) or opts for OAuth (Google/GitHub).
3. **Validation:** FastAPI backend validates credentials against the PostgreSQL user database.
   * *If invalid:* Display inline error banner (`#DC2626`) prompting re-entry.
   * *If valid:* Generate JWT session token, store in secure HTTP-only cookie.
4. **Destination:** User is redirected to their intended destination or user dashboard (showing past orders, serial numbers, and warranty tickets).

---

## 3. Product Discovery & Cart Management Flow
Details the path from initial search/browsing to adding high-end hardware items to the shopping cart.

1. **Search & Filter:** User inputs hardware keyword (e.g., "RTX 5090") or filters by category and price range in the sidebar.
2. **Catalog Interaction:** User clicks on a product card to open the **Product Detail Page (PDP)**.
3. **Specification & Inventory Check:** User reviews hardware specs, live stock count (fetched from Odoo 17 inventory module), and unique serial number tracking status.
4. **Cart Addition:** 
   * User selects quantity and clicks **[ Add to Cart ]**.
   * Local state updates instantly; cart badge increments counter (e.g., `Cart (3)`).
   * Toast notification confirms success (`#16A34A` Green banner).

---

## 4. Secure Checkout & Payment Flow
Outlines the streamlined transaction process from cart review to final order placement.

1. **Cart Review:** User clicks the cart icon and proceeds to `/checkout`.
2. **Shipping Form:** User enters shipping details (Full Name, Address, e.g., El Matareya, Cairo, phone number).
3. **Payment Method Selection:** User selects payment option:
   * *Option A:* Credit / Debit Card (Integrated payment gateway).
   * *Option B:* Cash on Delivery (COD).
4. **Order Summary Calculation:** Subtotal, shipping fees (EGP 150), and 14% VAT are automatically computed.
5. **Confirmation:** User clicks **[ Confirm & Pay Securely ]**.
   * Backend creates sales order in Odoo 17 ERP, decrements stock, assigns serial numbers, and clears user cart.
   * User is redirected to Order Success / Receipt screen.

---

## 5. RMA & Warranty Support Flow
Specifies how customers initiate hardware defect claims or track support tickets.

1. **Portal Access:** User navigates to the Support & Warranty Portal.
2. **Serial Number Entry:** User enters the hardware Serial Number ($S/N$) associated with their purchase.
3. **Claim Form Completion:**
   * User selects issue type (e.g., Hardware Defect, RMA).
   * User uploads photo/video proof (Max 50MB).
   * User enters detailed description of the issue.
4. **Ticket Submission:** User clicks **[ Submit RMA Claim Ticket ]**.
   * FastAPI integration automatically generates an Odoo Helpdesk ticket linked to the customer account and serial number.
   * User receives confirmation message with tracking ID and expected SLA response time (24–48 hours).

---
End of Document
