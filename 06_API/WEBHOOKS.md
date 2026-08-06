# Webhooks Architecture & Integration Specification (WEBHOOKS.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, PostgreSQL 15, Odoo REST/JSON-RPC)  

---

## 1. Introduction & Architecture Overview
This document defines the webhook architecture, event payloads, security standards, and reliability mechanisms for the **Elitedom Store** platform. In alignment with architecture principles (`AP-011 Event Driven Integration`), webhooks provide asynchronous, event-driven communication between the FastAPI e-commerce backend, the Odoo 17 ERP core, third-party payment gateways, and automated dropship suppliers.

---

## 2. Security & Authentication Standards

To protect against malicious tampering, replay attacks, and unauthorized payload injection, all webhook endpoints must adhere to rigorous security controls (referencing `API_SECURITY.md`):

* **HMAC-SHA256 Signatures:** Internal / Elitedom-controlled webhook requests must use `X-Elitedom-Signature`, computed using a pre-shared secret key and the raw request body payload. Third-party webhook providers must use their respective signature verification mechanisms. For Stripe webhooks, Elitedom must validate the `Stripe-Signature` header using Stripe's webhook signing secret.
* **IP Whitelisting:** Webhook endpoints accept traffic exclusively from verified partner subnets and Odoo ERP server IP addresses.
* **Idempotency Keys:** Critical transactional webhooks must include an idempotency header (`X-Idempotency-Key`) to ensure duplicate event deliveries are safely ignored by the processing engine.

---

## 3. Outgoing Webhooks (Elitedom to External Systems)

Outgoing webhooks notify third-party partners or suppliers of state changes within the e-commerce platform.

### 3.1. Automated Supplier Dropship Purchase Order (`POST /webhooks/supplier/dropship-po`)
* **Trigger:** An order is placed containing an item with `is_dropship_enabled = true` and current local stock is insufficient.
* **Target:** Verified third-party dropship supplier API endpoint.
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Elitedom-Signature: sha256=d3b07384d113edec49eaa6238ad5ff00...`
  * `X-Idempotency-Key: ord-2026-00142-po`
* **Payload Example:**
  ```json
  {
    "event": "dropship.po.created",
    "timestamp": 1718920192,
    "purchase_order_ref": "PO-2026-0891",
    "sales_order_ref": "SO2026-00142",
    "items": [
      {
        "sku": "CPU-INTEL-14700K",
        "quantity": 1,
        "shipping_address": "15 El-Matareya Street, Cairo, Egypt"
      }
    ]
  }
  ```

---

## 4. Incoming Webhooks (External Systems to Elitedom FastAPI)

Incoming webhooks allow external platforms (Odoo ERP and payment processors) to push state updates into the Elitedom backend.

### 4.1. Odoo ERP Inventory Bi-Directional Sync (`POST /webhooks/odoo/inventory-sync`)
* **Trigger:** Stock level adjustments or warehouse picking completions recorded inside Odoo 17 ERP.
* **Target:** Elitedom FastAPI backend (`https://api.elitedom.store/v1/webhooks/odoo/inventory-sync`).
* **Security:** Stripe webhook signature verification using the `Stripe-Signature` header and Stripe webhook signing secret. If additional payment gateways such as Paymob are integrated, their respective webhook signature verification mechanisms must be implemented separately.
* **Payload Example:**
  ```json
  {
    "event": "inventory.stock.updated",
    "timestamp": 1718920500,
    "sku": "CPU-INTEL-14700K",
    "warehouse_id": 1,
    "new_stock_qty": 12,
    "tracking_mode": "serial"
  }
  ```

### 4.2. Payment Gateway Status Callback (`POST /webhooks/payment/stripe-callback`)
* **Trigger:** Payment settlement completion or failure from the payment processor (Stripe / Paymob).
* **Target:** Elitedom FastAPI backend (`https://api.elitedom.store/v1/webhooks/payment/stripe-callback`).
* **Security:** HMAC signature verification using the payment gateway signing secret.
* **Payload Example:**
  ```json
  {
    "event": "payment.intent.succeeded",
    "timestamp": 1718920200,
    "order_number": "SO2026-00142",
    "payment_status": "paid",
    "amount_total": 18500.00,
    "currency": "EGP"
  }
  ```

---

## 5. Retry Policy, Error Handling & Dead Letter Queues (DLQ)

To ensure high availability and prevent data loss during network disruptions:
* **Exponential Backoff:** Failed webhook deliveries undergo automated retries using an exponential backoff schedule (e.g., intervals of 10s, 30s, 2m, 15m, 1h).
* **Maximum Retry Limit:** A maximum of 5 delivery attempts is enforced before the event is marked as failed.
* **Dead Letter Queue (DLQ):** Permanently failed webhook payloads are routed to an isolated Redis/PostgreSQL DLQ table for manual administrative review and debugging.

---

## 6. Monitoring & Logging
* **Delivery Metrics:** Real-time tracking of webhook success rates, response latency (ms), and HTTP status codes (200 OK vs 4xx/5xx errors).
* **Audit Trail:** All webhook dispatch and receipt events are securely recorded in the application logs for traceability and compliance.
---

### Webhook Signature Verification

- Internal / Elitedom-controlled webhooks:
  Use `X-Elitedom-Signature` for cryptographic signature verification.

- Stripe webhooks:
  Use Stripe's `Stripe-Signature` header and Stripe's official webhook signature verification mechanism.

`X-Elitedom-Signature` MUST NOT be used to validate Stripe webhooks.


Webhook
   │
   ├── Elitedom-controlled
   │       └── X-Elitedom-Signature
   │
   └── Stripe
           └── Stripe-Signature


Elitedom Internal Webhooks
        ↓
X-Elitedom-Signature

Stripe Webhooks
        ↓
Stripe-Signature

Paymob Webhooks
        ↓
Paymob's own verification mechanism

---
End of Document
