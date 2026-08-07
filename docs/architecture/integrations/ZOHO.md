# Zoho CRM & Desk Integration Specification (ZOHO.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Zoho CRM & Desk APIs, PostgreSQL 15)  

---

## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **Zoho (CRM & Desk)** within the **Elitedom Store** platform. Zoho powers advanced Customer Relationship Management (CRM) for B2B client accounts, lead tracking, and omnichannel customer support (Zoho Desk) for hardware warranty claims, RMA requests, and general customer inquiries.

In alignment with platform security standards (`API_SECURITY.md`) and event-driven architecture principles (`AP-011 Event Driven Integration`), data synchronization between the FastAPI backend, PostgreSQL, Odoo 17 ERP, and Zoho is managed asynchronously via background workers (Celery/Redis).

---

## 2. Core Use Cases & Triggers

### 2.1. B2B Customer & Lead Synchronization (Zoho CRM)
* **Trigger:** New B2B client registration or corporate account verification on the Elitedom store (`POST /auth/b2b-register`).
* **Action:** FastAPI initiates an asynchronous background task to create or update a corresponding Lead/Contact record within Zoho CRM, linking customer metadata, Egyptian governorate, and commercial details.

### 2.2. Support Ticket & RMA Creation (Zoho Desk)
* **Trigger:** Customer submits a hardware return merchandise authorization (RMA) or technical support ticket via the user portal (`POST /support/tickets`).
* **Action:** FastAPI generates a ticket record in PostgreSQL and provisions a synchronized support ticket in Zoho Desk, assigning it to warehouse or technical support staff based on the product SKU and serial number (`stock_lot`).

---

## 3. Core API Integration Endpoints & Payloads

### 3.1. Internal Zoho CRM / Desk Dispatcher Service
The FastAPI backend utilizes OAuth 2.0 authentication to interact with the Zoho REST APIs (`https://www.zohoapis.com/crm/v2/...` and `https://desk.zoho.com/api/v1/...`).

* **Request Payload Structure (Internal Service Call / Zoho Desk Ticket Creation):**
  ```json
  {
    "departmentId": "482919000000035001",
    "subject": "Hardware RMA Request: Intel Core i7-14700K",
    "description": "Processor thermal throttling issue under load. Serial number: SN-INTEL-98412.",
    "email": "user@elitedom.store",
    "phone": "+201000000000",
    "priority": "High",
    "category": "Warranty & Returns",
    "cf": {
      "cf_order_number": "SO2026-00142",
      "cf_governorate": "Cairo"
    }
  }
  ```

* **Zoho API Response (201 Created):**
  ```json
  {
    "id": "78491000000182003",
    "ticketNumber": "TKT-2026-0891",
    "status": "Open",
    "createdTime": "2026-07-24T03:22:00.000Z",
    "webUrl": "https://desk.zoho.com/support/elitedom/ShowTicket.do?id=78491000000182003"
  }
  ```

---

## 4. Webhook Event Handling (`/webhooks/zoho/callbacks`)

Zoho dispatches real-time event notifications (e.g., ticket status updates, agent replies, CRM deal status changes) to the Elitedom backend.

### 4.1. Endpoint Configuration
* **Endpoint:** `POST /webhooks/zoho/callbacks`
* **Security:** Validated via pre-shared secret tokens and IP whitelisting matching official Zoho webhook origin servers.

### 4.2. Webhook Payload Example (Ticket Closed)
```json
{
  "event": "ticket.closed",
  "ticket_id": "78491000000182003",
  "ticket_number": "TKT-2026-0891",
  "status": "Closed",
  "resolution": "Replacement unit dispatched via Odoo warehouse picking order WH/OUT/2026/00481."
}
```

---

## 5. Error Handling & Error Codes Mapping

Zoho integration failures map directly to standard platform error codes (`ERROR_CODES.md`):
* **`ELITE_1001` (HTTP 500):** `ZOHO_API_UNAVAILABLE` — Zoho API gateway timeout or service degradation.
* **`ELITE_4001` (HTTP 400):** `INVALID_TICKET_PAYLOAD` — Required ticket fields or customer mapping identifiers are missing.
* **`ELITE_7002` (HTTP 504):** `WEBHOOK_TARGET_TIMEOUT` — Zoho webhook notification callback failed to respond or encountered an authentication failure.

---

## 6. Authentication & Security

* **OAuth 2.0 Flow:** All API requests to Zoho are authenticated using short-lived access tokens dynamically refreshed via secure refresh tokens stored in encrypted environment vaults (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`).
* **Data Isolation:** Sensitive customer PII is transmitted over TLS 1.3 encryption channels.

Zoho
├── CRM
└── Desk

---
End of Document
