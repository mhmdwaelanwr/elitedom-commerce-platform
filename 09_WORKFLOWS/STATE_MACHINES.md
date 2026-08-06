# State Machines & Entity Lifecycle Specification (STATE_MACHINES.md)

**Document Classification:** Internal / Architecture & Operations  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store, Odoo 17 ERP, FastAPI Backend, PostgreSQL  

---

## 1. Executive Summary & Overview
This document defines the formal state machines and entity lifecycle rules governing business objects within the **Elitedom Store** e-commerce platform and its underlying **Odoo 17 ERP** core. Explicit state transitions ensure data consistency, prevent invalid operational sequences, and govern automated triggers (such as inventory reservation, notifications, and ledger hashing).

---

## 2. Sales Order (SO) State Machine
The Sales Order lifecycle tracks a customer order from initial creation to fulfillment and invoicing.

```text
[Draft / Cart] ---> [Confirmed] ---> [Locked / Processing] ---> [Done / Fulfilled]
       |                 |                     |
       v                 v                     v
  [Cancelled]       [Cancelled]           [Cancelled / Refunded]
```

### State Transitions Table
| Current State | Trigger Event | Target State | Automated Actions / Rules |
| :--- | :--- | :--- | :--- |
| **Draft** | User completes checkout / payment | **Confirmed** | Reserves inventory in Odoo warehouse; generates Sales Order reference. |
| **Confirmed** | Warehouse starts picking | **Locked** | Prevents further customer-side edits; initiates warehouse barcode scanning. |
| **Locked** | Delivery validated & items shipped | **Done** | Triggers Twilio SMS tracking notification and SendGrid PDF invoice generation. |
| **Draft / Confirmed** | Customer request or payment timeout | **Cancelled** | Releases reserved stock back to active inventory pools. |

---

## 3. Purchase Order (PO) Dropship State Machine
Applies to automated supplier-owned inventory dropshipping workflows.

```text
[Draft PO] ---> [To Approve] ---> [Purchase Order Sent] ---> [Received / Billed]
     |                 |
     v                 v
[Cancelled]       [Cancelled]
```

### State Transitions Table
| Current State | Trigger Event | Target State | Automated Actions / Rules |
| :--- | :--- | :--- | :--- |
| **Draft PO** | Customer confirms payment for dropship item | **To Approve** | Odoo automatically generates PO mapped to designated external supplier. |
| **To Approve** | Manager / System validation pass | **Purchase Order Sent** | Transmits approved PO to supplier via XML-RPC / automated email. |
| **Purchase Order Sent** | Supplier confirms shipment and tracking | **Received / Billed** | Links vendor bill with customer sales invoice; calculates net margins. |

---

## 4. RMA & Warranty Claim State Machine
Protects customer rights and store inventory against fraudulent warranty returns.

```text
[Submitted] ---> [Under Review] ---> [Approved] ---> [Replacement / Refunded]
     |                 |
     v                 v
[Rejected]        [Rejected]
```

### State Transitions Table
| Current State | Trigger Event | Target State | Automated Actions / Rules |
| :--- | :--- | :--- | :--- |
| **Submitted** | Customer submits claim via Typeform portal | **Under Review** | Auto-syncs data into Odoo Helpdesk ticket queue; attaches scanned Serial Number ($S/N$). |
| **Under Review** | Support agent verifies warranty window and $S/N$ | **Approved** | Creates automated return and replacement/refund order in Odoo. |
| **Under Review** | Invalid $S/N$ or expired warranty | **Rejected** | Dispatches rejection notification with verification notes to customer. |

---

## 5. Payment Transaction State Machine
Governs the payment gateway processing lifecycle.

```text
[Initiated] ---> [Authorized] ---> [Captured] ---> [Settled]
     |                 |                |
     v                 v                v
  [Failed]          [Voided]         [Refunded]
```

### State Transitions Table
| Current State | Trigger Event | Target State | Automated Actions / Rules |
| :--- | :--- | :--- | :--- |
| **Initiated** | Customer submits payment credentials | **Authorized** | Gateway holds funds on customer account; verifies token validity. |
| **Authorized** | Order confirmation check passes | **Captured** | Funds transferred to merchant account; triggers SO confirmation. |
| **Captured** | Successful reconciliation | **Settled** | Final payout batch processing completed. |
| **Authorized / Captured** | Fraud detection or order cancellation | **Voided / Refunded** | Reverses transaction charges and notifies accounting module. |

---
End of Document
