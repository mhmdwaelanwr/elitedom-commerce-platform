# Twilio SMS & Notification Integration Specification (TWILIO.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Twilio Programmable Messaging API, PostgreSQL 15)  

---

## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **Twilio SMS and Notification Services** within the **Elitedom Store** platform. Twilio powers critical customer communication channels, including One-Time Passwords (OTP) for user registration and login verification, automated order status notifications, shipping updates, and real-time alerts for warehouse staff.

In alignment with platform security standards (`API_SECURITY.md`) and event-driven architecture principles (`AP-011 Event Driven Integration`), all outbound messaging is orchestrated asynchronously via background workers (Celery/Redis) to prevent blocking the FastAPI e-commerce request lifecycle.

---

## 2. Core Notification Use Cases & Triggers

### 2.1. Customer Registration & Authentication (OTP)
* **Trigger:** User initiates account registration (`POST /auth/register`) or requests password recovery using an Egyptian mobile number (`+20...`).
* **Action:** FastAPI generates a cryptographically secure 6-digit OTP, stores it in Redis with a 5-minute TTL, and dispatches an SMS via Twilio Messaging API.

### 2.2. Order Confirmation & Payment Status
* **Trigger:** Successful checkout completion (`POST /checkout/order` or payment gateway webhook callback) [cite: 10, 13].
* **Action:** Transmits an SMS notification confirming the Sales Order reference (e.g., `SO2026-00142`) and estimated delivery timeframe in Cairo or other Egyptian governorates.

### 2.3. Shipping & Delivery Updates (Odoo ERP Integration)
* **Trigger:** Warehouse picking or delivery validation state changes inside Odoo 17 ERP (e.g., out for delivery).
* **Action:** Dispatches a tracking notification SMS to the customer containing shipping courier details.

---

## 3. Core API Integration Endpoints & Payloads

### 3.1. Internal Messaging Dispatcher Service
The FastAPI backend utilizes the Twilio Python SDK to interact with the Programmable Messaging API (`https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`).

* **Request Payload Structure (Internal Service Call):**
  ```json
  {
    "to": "+201000000000",
    "channel": "sms",
    "template_id": "otp_verification",
    "parameters": {
      "otp_code": "482919",
      "expiry_minutes": "5"
    }
  }
  ```

* **Twilio API Response (201 Created):**
  ```json
  {
    "sid": "SM1a2b3c4d5e6f7g8h9i0j...",
    "date_created": "Fri, 24 Jul 2026 03:22:00 +0000",
    "error_code": null,
    "error_message": null,
    "status": "queued",
    "to": "+201000000000",
    "from": "+18005550199",
    "body": "Your Elitedom verification code is 482919. Valid for 5 minutes."
  }
  ```

---

## 4. Webhook Event Handling (`/webhooks/twilio/status-callback`)

Twilio dispatches asynchronous delivery status reports to the Elitedom backend to track message delivery success, failures, or carrier rejections.

### 4.1. Endpoint Configuration
* **Endpoint:** `POST /webhooks/twilio/status-callback`
* **Security:** Validated via Twilio signature verification header (`X-Twilio-Signature`) and pre-shared auth tokens.

### 4.2. Webhook Payload Example (Message Delivered)
```json
{
  "MessageSid": "SM1a2b3c4d5e6f7g8h9i0j...",
  "MessageStatus": "delivered",
  "To": "+201000000000",
  "From": "+18005550199",
  "ErrorCode": null,
  "Channel": "sms"
}
```

---

## 5. Error Handling & Error Codes Mapping

Twilio transmission failures map directly to standard platform error codes (`ERROR_CODES.md`):
* **`ELITE_1001` (HTTP 500):** `TWILIO_API_UNAVAILABLE` — Twilio API gateway timeout or service outage.
* **`ELITE_4002` (HTTP 400):** `INVALID_PHONE_NUMBER` — The provided recipient mobile number is malformed or invalid according to E.164 standards.
* **`ELITE_7002` (HTTP 504):** `WEBHOOK_TARGET_TIMEOUT` — Twilio webhook status callback failed to respond or encountered an authentication signature mismatch.

---

## 6. Security, Rate Limiting & Cost Control

* **Credential Isolation:** Twilio Account SID, Auth Token, and Messaging Service SID are strictly stored as environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) within secure server vaults, never exposed to client applications.
* **Rate Limiting:** OTP dispatch routes are heavily rate-limited (max 3 requests per mobile number per 15 minutes) to prevent SMS toll fraud and abuse.

---
End of Document
