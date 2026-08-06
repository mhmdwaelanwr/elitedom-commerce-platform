# Odoo ERP Integration Guide (ODOO.md)

**Document Classification:** Internal / Architecture & Integration  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Executive Summary
This document outlines the technical architecture, data flows, and security protocols for the bidirectional integration between the **Elitedom FastAPI Backend** and the **Odoo 17 Community Edition ERP**. This integration ensures that inventory, orders, and customer data remain synchronized in real-time across both platforms.

---

## 2. Authentication & Security

### 2.1 API Communication (FastAPI $\rightarrow$ Odoo)
* **Protocol:** JSON-RPC / XML-RPC over HTTPS.
* **Authentication:** Dedicated Odoo API User (`elitedom_api_user`) with restricted access rights using an API Key.
* **Network:** IP Whitelisting applied on the Odoo server firewall to accept API requests exclusively from the Oracle Cloud VPS backend IP.

### 2.2 Webhook Security (Odoo $\rightarrow$ FastAPI)
* **Protocol:** REST API Webhooks via `POST` requests.
* **Signature Validation:** All outgoing webhooks from Odoo include an `X-Elitedom-Signature` header.
* **Algorithm:** HMAC-SHA256 hash of the request body using a shared secret key.
* **FastAPI Middleware:** Intercepts incoming webhooks, recalculates the hash, and rejects unauthorized requests with `401 Unauthorized`.

---

## 3. Data Sync Flows & Ownership

| Entity | Source of Truth | Sync Direction | Trigger Event |
| :--- | :--- | :--- | :--- |
| **Products (Catalog)** | Odoo | Odoo $\rightarrow$ FastAPI | Product creation or modification in Odoo backend. |
| **Inventory (Stock)** | Odoo | Odoo $\rightarrow$ FastAPI | Stock move validation (Delivery/Receipt) in Odoo Warehouse module. |
| **Customers** | Bidirectional | Both | User registration on Storefront OR manual entry in Odoo CRM. |
| **Sales Orders** | FastAPI | FastAPI $\rightarrow$ Odoo | Customer completes checkout and payment is authorized. |
| **Order Status** | Odoo | Odoo $\rightarrow$ FastAPI | Order shipped, invoiced, or cancelled in Odoo. |

---

## 4. Resilience & Error Handling
To mitigate the risk of network latency or temporary Odoo unavailability during peak traffic (Flash Sales), the integration employs an asynchronous retry mechanism:

1. **Queueing System:** FastAPI places outbound Odoo sync tasks into a **Redis / Celery** message queue.
2. **Exponential Backoff:** If Odoo fails to respond (Timeout or `500 Server Error`), the background worker retries the request with exponentially increasing delays (e.g., 5s, 15s, 45s).
3. **Dead Letter Queue (DLQ):** After 5 failed attempts, the payload is moved to a DLQ for manual inspection, and a critical alert is sent via Sentry to the Backend Lead.

---

## 5. Webhook Endpoints Reference

### 5.1 Update Inventory Hook
* **URL:** `POST /api/v1/webhooks/odoo/inventory`
* **Payload Structure:**
```json
{
  "event_id": "wh_83749293",
  "product_sku": "ED-EL-001",
  "new_quantity": 150,
  "warehouse_location": "WH/Stock",
  "timestamp": "2026-07-24T14:30:00Z"
}
```

### 5.2 Update Order Status Hook
* **URL:** `POST /api/v1/webhooks/odoo/order-status`
* **Payload Structure:**
```json
{
  "order_reference": "ED-ORD-2026-9921",
  "new_status": "shipped",
  "tracking_number": "AWB123456789",
  "carrier": "Aramex",
  "timestamp": "2026-07-24T15:00:00Z"
}
```

---
End of Document
