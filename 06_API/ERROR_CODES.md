# API Error Codes & Troubleshooting Specification (ERROR_CODES.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, PostgreSQL 15, Odoo REST/JSON-RPC)  

---

## 1. Introduction & Error Handling Philosophy
This document standardizes all application, API, integration, and database error codes for the **Elitedom Store** platform. Consistent error formatting ensures rapid debugging for backend developers, clear feedback for mobile and web frontend clients, and smooth synchronization with the **Odoo 17 ERP** backend.

Every error response adheres to a uniform JSON structure containing a machine-readable error code, an HTTP status code, a descriptive message, and an optional validation breakdown.

### Standard Error Response Format
```json
{
  "error": {
    "code": "ELITE_4001",
    "status": 400,
    "message": "Invalid stock quantity requested.",
    "details": {
      "sku": "CPU-INTEL-14700K",
      "available_qty": 14
    }
  }
}
```

---

## 2. Error Code Ranges & Categories

| Range | Category | Description |
| :--- | :--- | :--- |
| **1000–1999** | System & General Errors | Gateway timeouts, database connection drops, maintenance state. |
| **2000–2999** | Authentication & Authorization | JWT token expiration, invalid credentials, RBAC permission failures. |
| **3000–3999** | Product & Catalog Errors | SKU not found, invalid hardware compatibility parameters, pricing sync faults. |
| **4000–4999** | Cart, Checkout & Payment | Insufficient stock, payment gateway rejections, invalid checkout payload. |
| **5000–5999** | Inventory & Serial Tracking | Duplicate serial number intake, invalid warranty lookup, picking failure. |
| **6000–6999** | Odoo ERP Integration Errors | ERP connection timeout, JSON-RPC sync rejection, invalid partner mapping. |
| **7000–7999** | Webhooks & Third-Party APIs | Invalid HMAC signature, webhook retry exhaustion, DLQ routing errors. |

---

## 3. Detailed Error Code Registry

### 3.1. System & General Errors (1000–1999)
* **`ELITE_1001` (HTTP 500):** `INTERNAL_SERVER_ERROR` — An unhandled exception occurred within the FastAPI backend service.
* **`ELITE_1002` (HTTP 503):** `DATABASE_CONNECTION_TIMEOUT` — Failed to establish or maintain connection with the PostgreSQL 15 database instance.
* **`ELITE_1003` (HTTP 503):** `ERP_MAINTENANCE_MODE` — Odoo ERP synchronization is temporarily paused for scheduled maintenance.

### 3.2. Authentication & Authorization Errors (2000–2999)
* **`ELITE_2001` (HTTP 401):** `INVALID_CREDENTIALS` — Incorrect email or password supplied during user login.
* **`ELITE_2002` (HTTP 401):** `TOKEN_EXPIRED` — The provided JWT access token has expired and must be refreshed.
* **`ELITE_2003` (HTTP 403):** `INSUFFICIENT_PERMISSIONS` — The authenticated user lacks the required role (`Customer`, `B2B_Client`, `Warehouse_Staff`, `Administrator`) to access this endpoint.
* **`ELITE_2004` (HTTP 401):** `INVALID_HMAC_SIGNATURE` — The server-to-server request failed cryptographic verification due to a missing or invalid `X-Elitedom-Signature` header.

### 3.3. Product Catalog & PC Builder Errors (3000–3999)
* **`ELITE_3001` (HTTP 404):** `PRODUCT_NOT_FOUND` — The requested product ID or SKU does not exist in the catalog.
* **`ELITE_3002` (HTTP 400):** `INCOMPATIBLE_HARDWARE_SELECTION` — The selected PC Builder hardware items violate compatibility rules (e.g., mismatched `socket_type` or `ram_type`).
* **`ELITE_3003` (HTTP 400):** `PRICING_NOT_AVAILABLE` — No valid currency exchange rate or tier pricelist (`product.pricelist`) is configured for the requested currency.

### 3.4. Cart, Checkout & Payment Errors (4000–4999)
* **`ELITE_4001` (HTTP 400):** `INSUFFICIENT_STOCK` — The ordered quantity exceeds the available stock level recorded in Odoo multi-warehouse inventory.
* **`ELITE_4002` (HTTP 400):** `INVALID_CHECKOUT_PAYLOAD` — Required shipping address, Egyptian governorate, or payment method fields are missing or malformed.
* **`ELITE_4003` (HTTP 402):** `PAYMENT_GATEWAY_DECLINED` — The payment transaction was declined or failed authorization by the payment processor (Stripe / Paymob).
* **`ELITE_4004` (HTTP 409):** `DUPLICATE_IDEMPOTENCY_KEY` — A transaction or checkout request with the same idempotency key was already processed.

### 5.5. Inventory, Warehouse & Serial Tracking Errors (5000–5999)
* **`ELITE_5001` (HTTP 400):** `DUPLICATE_SERIAL_NUMBER` — The scanned physical Serial Number (`stock_lot`) already exists in the system.
* **`ELITE_5002` (HTTP 404):** `SERIAL_NUMBER_NOT_FOUND` — The queried serial number is missing or was not registered during warehouse intake.
* **`ELITE_5003` (HTTP 400):** `RMA_TICKET_EXPIRED` — The warranty period for the associated hardware item has expired, preventing RMA claim creation.

### 5.6. Odoo ERP Integration Errors (6000–6999)
* **`ELITE_6001` (HTTP 502):** `ERP_SYNC_FAILED` — Failed to synchronize sales order or customer partner record (`res.partner`) with the Odoo 17 ERP database.
* **`ELITE_6002` (HTTP 422):** `ERP_VALIDATION_ERROR` — Odoo ORM rejected the payload due to missing mandatory relational fields or constraint violations.

### 5.7. Webhooks & Third-Party API Errors (7000–7999)
* **`ELITE_7001` (HTTP 400):** `WEBHOOK_SIGNATURE_MISSING` — The incoming webhook request lacks the mandatory security verification header.
* **`ELITE_7002` (HTTP 504):** `WEBHOOK_TARGET_TIMEOUT` — The external dropship supplier or partner endpoint failed to respond within the allowed timeout window.
* **`ELITE_7003` (HTTP 500):** `WEBHOOK_DLQ_ROUTING` — Event delivery permanently failed after maximum retry attempts and was routed to the Dead Letter Queue.

---
End of Document
