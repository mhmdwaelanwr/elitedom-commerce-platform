# Operational Workflows & Sequence Diagrams Specification (SEQUENCE_DIAGRAMS.md)

**Document Classification:** Internal / Architecture & Operations  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store, Odoo 17 ERP, FastAPI, Twilio, SendGrid, Typeform, Hedera HCS  

---

## 1. Executive Summary & Overview
This document defines the sequence diagrams and operational interactions for the core business workflows of the **Elitedom Store** integrated within **Odoo 17 ERP**. It outlines step-by-step communication between customers, e-commerce storefronts, ERP modules, third-party communication channels (Twilio, SendGrid, Typeform), and decentralized ledger networks (Hedera HCS).

---

## 2. Direct Retail Workflow (In-Stock Hardware)
*Applies to hardware inventory stored in local warehouse facilities.*

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Store as Elitedom Store (FastAPI)
    participant Odoo as Odoo 17 ERP
    participant Warehouse as Warehouse Staff
    participant Twilio as Twilio SMS
    participant SendGrid as SendGrid Email

    Customer->>Store: Place Order (In-Stock Hardware)
    Store->>Odoo: Create Confirmed Sales Order (SO)
    Odoo->>Odoo: Reserve Inventory Item (Prevent Double-Selling)
    Warehouse->>Odoo: Open Delivery Order (DO) & Scan Serial Number (S/N)
    Odoo->>Odoo: Bind Serial Number to Customer Ticket
    Odoo->>Twilio: Trigger Dispatch SMS with Tracking Details
    Twilio-->>Customer: Receive SMS Notification
    Odoo->>SendGrid: Generate PDF Customer Invoice
    SendGrid-->>Customer: Deliver Invoice to Inbox
```

---

## 3. Automated Dropshipping Workflow
*Applies to supplier-owned inventory shipped directly from vendors to customers.*

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Store as Elitedom Store
    participant Odoo as Odoo 17 ERP
    participant Supplier as External Supplier

    Customer->>Store: Complete Payment for Dropship Item
    Store->>Odoo: Confirm Payment & Trigger Dropship Route
    Odoo->>Odoo: Auto-Generate Purchase Order (PO)
    Odoo->>Supplier: Transmit Approved Purchase Order
    Supplier->>Supplier: Print Elitedom White-Label Shipping Label
    Supplier->>Customer: Ship Item Directly to Buyer
    Odoo->>Odoo: Link Vendor Bill with Customer Sales Invoice
    Odoo->>Odoo: Calculate Net Profit Margins Automatically
```

---

## 4. Serial Tracking & RMA Warranty Workflow
*Protects both customer rights and store inventory against fraudulent returns.*

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Typeform as Typeform RMA Portal
    participant Odoo as Odoo Helpdesk / ERP
    participant Support as Support Agent

    Note over Odoo: Initial receipt logs scanned Serial Number under stock.lot
    Note over Odoo: Sale links Serial Number to invoice & sets warranty start date
    Customer->>Typeform: Submit Claim (Photos/Videos + Serial Number)
    Typeform->>Odoo: Auto-Sync Data to Create Helpdesk Ticket
    Support->>Odoo: Verify Serial Number Match & Active Warranty Window
    alt Approved Claim
        Odoo->>Odoo: Create Automated Return & Replacement / Refund Order
        Odoo-->>Customer: Send Approval & Return Instructions
    else Rejected Claim
        Support-->>Customer: Notify with Detailed Verification Notes
    end
```

---

## 5. Background Automation & Maintenance Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Odoo Cron / Automated Actions
    participant Linux as Systemd Python Scripts
    participant Hedera as Hedera HCS
    participant Storage as Oracle Cloud Storage

    Cron->>Cron: Execute Scheduled Pricing & Inventory Updates
    Linux->>Linux: Monitor Server Health & System Resources
    Linux->>Hedera: Hash Payment & B2B Order Records to Audit Topic
    Linux->>Storage: Rotate and Clear Old System Logs (Prevent Capacity Fill)
```

---
End of Document
