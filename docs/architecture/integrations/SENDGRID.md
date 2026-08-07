# SendGrid Email & Transactional Notification Integration Specification (SENDGRID.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, SendGrid Web API v3, PostgreSQL 15)  

---

## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **SendGrid Email Services** within the **Elitedom Store** platform. SendGrid powers critical transactional and marketing email communications, including user registration confirmations, password reset links, detailed e-commerce purchase invoices, order status tracking updates, and automated Odoo ERP purchasing documentatio, Primary Transactional Email Provider.

In alignment with platform security standards (`API_SECURITY.md`) and event-driven architecture principles (`AP-011 Event Driven Integration`), all outbound email dispatch is orchestrated asynchronously via background workers (Celery/Redis) to ensure high throughput and prevent blocking the FastAPI e-commerce request lifecycle.

---

## 2. Core Email Use Cases & Triggers

### 2.1. Account Registration & Email Verification
* **Trigger:** User registers a new account (`POST /auth/register`) [cite: 7].
* **Action:** FastAPI generates a secure email verification token, stores it in PostgreSQL/Redis with a 24-hour TTL, and triggers a SendGrid dynamic template email containing the verification link.

### 2.2. Order Invoices & Payment Receipts
* **Trigger:** Successful checkout completion (`POST /checkout/order` or payment gateway webhook callback) [cite: 10, 13].
* **Action:** Transmits a rich HTML invoice containing the Sales Order reference (`SO2026-XXXXX`), itemized hardware breakdown, pricing in Egyptian Pounds (EGP), and billing details.

### 2.3. Odoo ERP Automated Purchase Orders & Quotations
* **Trigger:** B2B client quotation generation or automated supplier dropship purchase order trigger.
* **Action:** Dispatches formal PDF purchase order attachments synchronized directly from Odoo 17 ERP.

---

## 3. Core API Integration Endpoints & Payloads

### 3.1. Internal Email Dispatcher Service
The FastAPI backend utilizes the official SendGrid Python SDK interacting with the Mail Send API (`https://api.sendgrid.com/v3/mail/send`).

* **Request Payload Structure (Internal Service Call / SendGrid API v3):**
  ```json
  {
    "personalizations": [
      {
        "to": [{"email": "user@elitedom.store", "name": "Mohamed Anwar"}],
        "dynamic_template_data": {
          "order_number": "SO2026-00142",
          "order_date": "2026-07-24",
          "total_amount": "18,500.00 EGP",
          "shipping_address": "15 El-Matareya Street, Cairo",
          "tracking_url": "https://elitedom.store/orders/SO2026-00142"
        }
      }
    ],
    "from": {"email": "no-reply@elitedom.store", "name": "Elitedom Store"},
    "template_id": "d-1a2b3c4d5e6f7g8h9i0j"
  }
  ```

---

## 4. Webhook Event Handling (`/webhooks/sendgrid/events`)

SendGrid Event Webhook dispatches real-time email delivery status events (e.g., delivered, bounced, opened, clicked, spam reported) to the Elitedom backend for monitoring and analytics.

### 4.1. Endpoint Configuration
* **Endpoint:** `POST /webhooks/sendgrid/events`
* **Security:** Validated via SendGrid Event Webhook Public Key Signature verification (`X-Twilio-Email-Event-Webhook-Signature`).

### 4.2. Webhook Payload Example (Delivered Event)
```json
[
  {
    "email": "user@elitedom.store",
    "timestamp": 1718920200,
    "event": "delivered",
    "sg_event_id": "sg_delivery_ev_1a2b3c",
    "sg_message_id": "msg_xyz123.filter01.p0...",
    "smtp-id": "<202607240322.12345@sendgrid.net>"
  }
]
```

---

## 5. Error Handling & Error Codes Mapping

SendGrid delivery failures map directly to standard platform error codes (`ERROR_CODES.md`):
* **`ELITE_1001` (HTTP 500):** `SENDGRID_API_UNAVAILABLE` — SendGrid API gateway timeout or service degradation.
* **`ELITE_4002` (HTTP 400):** `INVALID_EMAIL_ADDRESS` — The recipient email address format is invalid or rejected by syntax validation.
* **`ELITE_7002` (HTTP 504):** `WEBHOOK_TARGET_TIMEOUT` — SendGrid event webhook notification failed verification or timed out.

---

## 6. Deliverability, Domain Authentication & Security

* **DNS Authentication:** Fully configured SPF, DKIM, and DMARC records for `elitedom.store` to ensure maximum inbox placement and protect against email spoofing.
* **API Key Isolation:** SendGrid API keys are strictly restricted to "Mail Send" permissions and stored securely in environment vaults (`SENDGRID_API_KEY`).

---

Email Architecture
│
├── SendGrid
│   └── Transactional Email
│       ├── Welcome emails
│       ├── Password reset
│       ├── Order notifications
│       └── Invoice emails
│
├── ZeptoMail
│   └── Backup / Alternative Transactional Email
│
└── Zoho
    └── Business Email + CRM/Desk

SendGrid = Primary
ZeptoMail = Backup/Secondary
Zoho = CRM/Desk/Business Email

---
End of Document
