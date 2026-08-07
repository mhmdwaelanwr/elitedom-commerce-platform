# C4 Dynamic Architecture - Elitedom Store

Document Classification: Internal  
Version: 1.0  
Status: Approved  
Owner: Solution Architecture  
Target System: Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Introduction & Purpose
This document defines the **Level 4 Dynamic (C4 Dynamic)** architectural model for the **Elitedom Store** platform. It illustrates how the containers and components collaborate at runtime to execute a specific, critical business scenario: **End-to-End Checkout, Payment Processing, Odoo ERP Order Creation, and Notification Dispatch**.

---

## 2. Dynamic Diagram (Mermaid) - Checkout & Order Fulfillment Scenario

```mermaid
C4Dynamic
    title Dynamic diagram for End-to-End Checkout and Order Fulfillment Scenario (Elitedom Store)

    Person(customer, "Customer", "Submits cart and executes online payment.")
    Container(web_app, "Web Storefront / Mobile App", "Next.js / Flutter", "User interface for shopping and checkout.")
    Container(api_gateway, "API Gateway & Middleware", "Python, FastAPI", "Orchestrates order flow, payment webhooks, and ERP integration.")
    System_Ext(stripe, "Stripe Payment Gateway", "Authorizes and captures online card transactions.")
    Container(odoo_erp, "Odoo 17 ERP Backbone", "Python, Odoo 17", "Master system of record for sales orders, inventory, and accounting.")
    ContainerDb(postgresql, "PostgreSQL Database", "PostgreSQL 16", "Persists transactional data and stock records.")
    System_Ext(notifications, "Twilio & SendGrid", "Dispatches customer SMS and email receipts.")

    Rel(customer, web_app, "1. Clicks 'Place Order' and submits payment info", "HTTPS")
    Rel(web_app, api_gateway, "2. Forwards checkout payload and cart tokens", "HTTPS / JSON")
    Rel(api_gateway, stripe, "3. Creates Payment Intent / Charge request", "REST API")
    Rel(stripe, api_gateway, "4. Dispatches payment success webhook event", "Webhook / REST API")
    Rel(api_gateway, odoo_erp, "5. Instantiates official Sales Order & Invoice", "XML-RPC / REST")
    Rel(odoo_erp, postgresql, "6. Commits order rows, reserves stock, updates ledger", "SQL / TCP")
    Rel(api_gateway, notifications, "7. Triggers order confirmation SMS and email", "REST API")
```

---

## 3. Step-by-Step Scenario Walkthrough

### Step 1 & 2: Order Submission
* The **Customer** reviews their cart on the **Web Storefront or Mobile App** and initiates checkout.
* The client application transmits the encrypted order payload and cart items to the **API Gateway & Middleware** (FastAPI).

### Step 3 & 4: Payment Processing & Webhook
* The **API Gateway** communicates with **Stripe** to authorize and capture the payment via a secure Payment Intent.
* Upon successful payment capture, **Stripe** asynchronously pushes a payment success webhook notification back to the **API Gateway**.

### Step 5 & 6: ERP Order Creation & Inventory Reservation
* Upon receiving the payment confirmation webhook, the **API Gateway** calls the **Odoo 17 ERP Backbone** via secure XML-RPC/REST APIs to create an official Sales Order and generate a digital invoice.
* **Odoo 17** processes the business rules, triggers the multi-warehouse stock routing (supporting the hybrid stock model), and commits the transaction rows to the **PostgreSQL Database**.

### Step 7: Notification Dispatch
* Simultaneously, the **API Gateway** invokes the **Notification Dispatcher** module to send a real-time order confirmation SMS via **Twilio** and an itemized invoice email via **SendGrid** to the customer.

---
End of Document
