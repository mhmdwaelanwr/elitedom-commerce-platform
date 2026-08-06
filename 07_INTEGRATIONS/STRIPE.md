# Stripe Payment Gateway Integration Specification (STRIPE.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Stripe API v2024-06-20, PostgreSQL 15)  

---

## 1. Executive Summary & Integration Architecture
This document defines the technical integration specification for **Stripe Payment Gateway** within the **Elitedom Store** platform. Stripe serves as a primary international and local payment processor, handling credit/debit card transactions, Apple Pay, Google Pay, and localized multi-currency settlements (supporting Egyptian Pounds - EGP and USD).

In alignment with platform security standards (`API_SECURITY.md`) and architecture principles (`AP-016 Idempotency`), all payment flows are designed to be secure, stateless, and strictly idempotent to prevent duplicate billing or race conditions between the FastAPI backend and Odoo 17 ERP.

---

## 2. Payment Checkout Lifecycle & Flow

The Elitedom platform utilizes **Stripe Checkout Sessions** and **Payment Intents** to process transactions securely without storing raw cardholder data (maintaining PCI-DSS scope reduction).

1. **Cart Submission:** The user initiates checkout via `POST /checkout/order` on the FastAPI backend.
2. **Order Creation:** FastAPI creates a pending Sales Order (`SO2026-XXXXX`) in PostgreSQL and synchronizes a draft quotation with Odoo 17 ERP.
3. **Stripe Session Initialization:** The backend invokes the Stripe API to create a Checkout Session, passing metadata (order number, customer ID, Egyptian governorate).
4. **Client Redirect:** The client receives a secure Stripe Hosted Checkout URL (`payment_gateway_url`) and redirects the shopper.
5. **Webhook Callback:** Upon successful or failed authorization, Stripe dispatches an asynchronous webhook event to Elitedom (`/webhooks/payment/stripe-callback`), triggering order confirmation, inventory allocation in Odoo, and Hedera blockchain audit hashing.

---

## 3. Core API Integration Endpoints

### 3.1. Initialize Stripe Checkout Session
* **Endpoint (Internal FastAPI):** `POST /checkout/order`
* **Request Payload Example:**
  ```json
  {
    "partner_id": 1042,
    "shipping_address": "15 El-Matareya Street, Cairo",
    "governorate": "Cairo",
    "payment_method": "stripe_credit_card",
    "items": [
      {
        "product_id": 501,
        "sku": "CPU-INTEL-14700K",
        "quantity": 1,
        "price": 18500.00
      }
    ]
  }
  ```
* **Response Payload Example (201 Created):**
  ```json
  {
    "order_number": "SO2026-00142",
    "odoo_order_id": 8841,
    "payment_gateway_url": "https://checkout.stripe.com/pay/cs_test_a1b2c3d4...",
    "hedera_tx_id": "0.0.482919@1718920192.0001"
  }
  ```

---

## 4. Webhook Event Handling (`/webhooks/payment/stripe-callback`)

All incoming Stripe webhooks must be cryptographically verified using the Stripe webhook signing secret (`STRIPE_WEBHOOK_SECRET`) and the `Stripe-Signature` request header.

### 4.1. Supported Stripe Events
* **`checkout.session.completed` / `payment_intent.succeeded`:** Confirms successful fund capture. Updates order status to `paid`, triggers Odoo sales order confirmation, and reserves warehouse stock.
* **`payment_intent.payment_failed`:** Marks order payment status as `failed`, logs the incident, and notifies the client to retry or use an alternative payment method.

### 4.2. Webhook Payload Example (`payment_intent.succeeded`)
```json
{
  "id": "evt_1PqRst2eZvKYlo2C...",
  "object": "event",
  "api_version": "2024-06-20",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_3PqRst2eZvKYlo2C0...",
      "object": "payment_intent",
      "amount": 1850000,
      "currency": "egp",
      "status": "succeeded",
      "metadata": {
        "order_number": "SO2026-00142",
        "partner_id": "1042"
      }
    }
  }
}
```

---

## 5. Idempotency & Fault Tolerance

* **Idempotency Keys:** Every Stripe API request dispatched from FastAPI includes a unique idempotency key derived from the order reference (`X-Idempotency-Key: ord-2026-00142-stripe`) to prevent duplicate charges in the event of network timeouts or retries.
* **Webhook Retry Logic:** If the Elitedom webhook endpoint encounters an internal error (HTTP 5xx), Stripe automatically retries delivery using an exponential backoff schedule for up to 72 hours.

---

## 6. Error Handling & Error Codes

Stripe payment failures map directly to standard Elitedom error codes (`ERROR_CODES.md`):
* **`ELITE_4003` (HTTP 402):** `PAYMENT_GATEWAY_DECLINED` — Triggered when Stripe returns a card decline, insufficient funds, or fraud block error.
* **`ELITE_4004` (HTTP 409):** `DUPLICATE_IDEMPOTENCY_KEY` — Triggered when a checkout transaction retry uses an already processed idempotency token.
* **`ELITE_7001` (HTTP 400):** `WEBHOOK_SIGNATURE_MISSING` — Triggered when the `Stripe-Signature` header is absent or invalid during webhook processing.

---

## 7. Security & Compliance Standards

* **TLS 1.3 Encryption:** All communication between FastAPI and Stripe API endpoints is secured over TLS 1.3.
* **No PAN Data Storage:** Primary Account Numbers (PAN), CVV codes, and magnetic stripe data never touch Elitedom servers or PostgreSQL databases, ensuring full compliance with PCI-DSS SAQ A standards.

---
End of Document
