# ZeptoMail (Zoho Transactional Email) Integration Specification (ZEPTOMAIL.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, ZeptoMail API v1.1, PostgreSQL 15)  

--- 
## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **ZeptoMail by Zoho** within the **Elitedom Store** platform. ZeptoMail serves as the a secondary/backup transactional email provider for Elitedom. for sending automated customer communications, including user registration confirmations, password resets, e-commerce order invoices, payment receipts, and automated Odoo ERP purchase documentation.

In alignment with platform security standards (`API_SECURITY.md`) and event-driven architecture principles (`AP-011 Event Driven Integration`), all outbound transactional email dispatch is orchestrated asynchronously via background workers (Celery/Redis) to ensure high throughput and prevent blocking the FastAPI e-commerce request lifecycle.

---

## 2. Core Email Use Cases & Triggers

### 2.1. Account Registration & Email Verification
* **Trigger:** User registers a new customer or B2B corporate account (`POST /auth/register`) [cite: 7].
* **Action:** FastAPI generates a secure email verification token, stores it in PostgreSQL/Redis with a 24-hour TTL, and triggers ZeptoMail to dispatch a verification link email.

### 2.2. Order Invoices & Payment Receipts
* **Trigger:** Successful checkout completion (`POST /checkout/order` or payment gateway webhook callback) [cite: 10, 13].
* **Action:** Transmits a rich HTML invoice containing the Sales Order reference (`SO2026-XXXXX`), itemized hardware breakdown, pricing in Egyptian Pounds (EGP), and delivery details.

### 2.3. Odoo ERP Automated Purchase Orders & Quotations
* **Trigger:** B2B client quotation generation or automated supplier dropship purchase order trigger from Odoo 17 ERP.
* **Action:** Dispatches formal PDF purchase order attachments synchronized directly from Odoo 17 ERP.

---

## 3. Core API Integration Endpoints & Payloads

### 3.1. Internal ZeptoMail Dispatcher Service
The FastAPI backend utilizes the ZeptoMail REST API (`https://api.zeptomail.com/v1.1/email`) authenticated via Send Mail token headers (`Authorization: Zoho-enczapikey ...`).

* **Request Payload Structure (Internal Service Call / ZeptoMail API v1.1):**
  ```json
  {
    "from": {
      "address": "no-reply@elitedom.store",
      "name": "Elitedom Store"
    },
    "to": [
      {
        "email_address": {
          "address": "user@elitedom.store",
          "name": "Mohamed Anwar"
        }
      }
    ],
    "subject": "Order Confirmation - SO2026-00142",
    "htmlbody": "<div><h1>Thank you for your order, Mohamed!</h1><p>Your order SO2026-00142 for Intel Core i7-14700K has been successfully placed.</p></div>",
    "bounce_address": "bounce@elitedom.store"
  }
  ```

* **ZeptoMail API Response (200 OK):**
  ```json
  {
    "message": "The email has been successfully sent.",
    "data": [
      {
        "code": "EM_100",
        "additional_info": {},
        "message": "Email accepted",
        "tracking_id": "zm_tr_98412001928"
      }
    ],
    "request_id": "req_849201938472"
  }
  ```

---

## 4. Webhook Event Handling (`/webhooks/zeptomail/events`)

ZeptoMail Event Webhook dispatches real-time email delivery status events (e.g., sent, delivered, bounced, opened, clicked) to the Elitedom backend for monitoring and analytics.

### 4.1. Endpoint Configuration
* **Endpoint:** `POST /webhooks/zeptomail/events`
* **Security:** Validated via pre-shared secret token headers and signature verification matching official Zoho/ZeptoMail origin servers.

### 4.2. Webhook Payload Example (Delivered Event)
```json
{
  "event": "EmailDelivered",
  "timestamp": "2026-07-24T03:22:00+02:00",
  "data": {
    "bounce_rate": "0.0",
    "email_address": "user@elitedom.store",
    "tracking_id": "zm_tr_98412001928",
    "subject": "Order Confirmation - SO2026-00142"
  }
}
```

---

## 5. Error Handling & Error Codes Mapping

ZeptoMail delivery failures map directly to standard platform error codes (`ERROR_CODES.md`):
* **`ELITE_1001` (HTTP 500):** `ZEPTOMAIL_API_UNAVAILABLE` — ZeptoMail API gateway timeout or service degradation.
* **`ELITE_4002` (HTTP 400):** `INVALID_EMAIL_ADDRESS` — The recipient email address format is malformed or invalid.
* **`ELITE_7002` (HTTP 504):** `WEBHOOK_TARGET_TIMEOUT` — ZeptoMail event webhook notification failed to respond or encountered an authentication failure.

---

## 6. Deliverability, Domain Authentication & Security

* **Mail Agents & Domain Configuration:** Configured with dedicated Mail Agents for `elitedom.store`, including verified SPF, DKIM, and DMARC records to maximize inbox placement across major email providers.
* **Token Isolation:** Send Mail API tokens are securely stored in environment vaults (`ZEPTOMAIL_API_TOKEN`) and restricted to backend server communication.

---

                    ELITEDOM
                       │
                       ▼
                Email Dispatcher
                       │
                       ▼
                  ZeptoMail
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
          Welcome    Invoice   Password
          Email       Email     Reset


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

---

End of Document
