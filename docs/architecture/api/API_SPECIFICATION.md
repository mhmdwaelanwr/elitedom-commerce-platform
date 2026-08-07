# API Specification & Integration Document - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration (Odoo 17.0 REST/JSON-RPC API & Mobile Client SDK)  

---

## 1. Introduction & Architecture Overview
This document defines the complete Application Programming Interface (API) specification for the **Elitedom Store** platform. It covers backend service endpoints, Odoo ERP integration bridges, future mobile application endpoints (optimized for Flutter clients), and third-party webhook interfaces. 

- **Base URL (Production):** `https://api.elitedom.store/v1`
- **Base URL (Staging):** `https://staging-api.elitedom.store/v1`
- **Authentication Protocol:** Bearer Token (JWT) for user sessions; API Key / HMAC Signature for server-to-server and ERP webhooks.
- **Data Format:** JSON (Request & Response payloads).

---

## 2. Authentication & Authorization API (`/auth`)

### 2.1. Customer Registration
- **Endpoint:** `POST /auth/register`
- **Description:** Registers a new user account with email, Egyptian mobile number, and password.
- **Request Body:**
  ```json
  {
    "name": "Mohamed Anwar",
    "email": "user@elitedom.store",
    "mobile": "+201000000000",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": "success",
    "message": "Verification code sent via SMS/Email",
    "user_id": 1042
  }
  ```

### 2.2. User Login & Token Generation
- **Endpoint:** `POST /auth/login`
- **Description:** Authenticates user credentials and returns a JWT access token and refresh token.
- **Request Body:**
  ```json
  {
    "email": "user@elitedom.store",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "dGhpc19pc19hX3JlZnJlc2h...",
    "expires_in": 3600,
    "role": "Customer"
  }
  ```

### 2.3. Social Login (Google / Apple OAuth)
- **Endpoint:** `POST /auth/oauth`
- **Description:** Authenticates users via Google or Apple OAuth tokens.
- **Request Body:**
  ```json
  {
    "provider": "google",
    "id_token": "eyJhbGciOiJSUzI1NiIs..."
  }
  ```

---

## 3. Product Catalog & Search API (`/products`)

### 3.1. Fetch Product Catalog (Paginated & Filtered)
- **Endpoint:** `GET /products`
- **Query Parameters:** `category_id`, `brand`, `min_price`, `max_price`, `page`, `limit`
- **Response (200 OK):**
  ```json
  {
    "total_count": 145,
    "page": 1,
    "limit": 20,
    "products": [
      {
        "id": 501,
        "name": "Intel Core i7-14700K",
        "sku": "CPU-INTEL-14700K",
        "price": 18500.00,
        "stock_qty": 14,
        "is_dropship_enabled": false
      }
    ]
  }
  ```

### 3.2. Typo-Tolerant Search (Algolia Integration)
- **Endpoint:** `GET /products/search`
- **Query Parameters:** `q` (search query string)
- **Response (200 OK):** Returns matching products with highlighted snippets and facet filters within 300ms.

---

## 4. Shopping Cart & Checkout API (`/cart`, `/checkout`)

### 4.1. Sync Persistent Cart
- **Endpoint:** `POST /cart/sync`
- **Description:** Synchronizes local storage guest cart items with the authenticated user's database cart.
- **Request Body:**
  ```json
  {
    "items": [
      {"product_id": 501, "quantity": 1}
    ]
  }
  ```

### 4.2. Submit Secure Checkout Order
- **Endpoint:** `POST /checkout/order`
- **Description:** Places an order, selects payment method, triggers Odoo ERP order synchronization, and invokes Hedera audit hashing.
- **Request Body:**
  ```json
  {
    "partner_id": 1042,
    "shipping_address": "15 El-Matareya Street, Cairo",
    "governorate": "Cairo",
    "payment_method": "credit_card",
    "items": [{"product_id": 501, "quantity": 1, "price": 18500.00}]
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "order_number": "SO2026-00142",
    "odoo_order_id": 8841,
    "payment_gateway_url": "https://checkout.stripe.com/pay/cs_test_...",
    "hedera_tx_id": "0.0.482919@1718920192.0001"
  }
  ```

---

## 5. Mobile Application Integration (Future Flutter Client SDK)
*Designed specifically to support native mobile application workflows, push notifications, and offline caching.*

### 5.1. Register Mobile Push Token
- **Endpoint:** `POST /mobile/device/register`
- **Description:** Registers Firebase Cloud Messaging (FCM) or APNs token for order status push notifications.
- **Request Body:**
  ```json
  {
    "user_id": 1042,
    "device_token": "fcm_token_string_here...",
    "platform": "android"
  }
  ```

### 5.2. Barcode Scanning Lookup (Warehouse & Inventory App)
- **Endpoint:** `GET /mobile/inventory/scan`
- **Query Parameters:** `barcode` (Scanned SKU or barcode string)
- **Description:** Allows warehouse staff using a mobile scanner app to instantly retrieve product stock level, bin location, and pricing details.
- **Response (200 OK):**
  ```json
  {
    "sku": "CPU-INTEL-14700K",
    "name": "Intel Core i7-14700K",
    "stock_qty": 14,
    "warehouse_location": "Rack-B4-Shelf2"
  }
  ```

---

## 6. Third-Party & Partner Integration APIs

### 6.1. Automated Supplier Dropship Webhook
- **Endpoint:** `POST /webhooks/supplier/dropship-po`
- **Description:** Automatically transmits a digital Purchase Order payload to verified third-party suppliers when an out-of-stock item is ordered.
- **Security:** Requires HMAC-SHA256 signature in request headers (`X-Elitedom-Signature`).

### 6.2. Odoo ERP Bi-Directional Stock Sync Webhook
- **Endpoint:** `POST /webhooks/odoo/inventory-sync`
- **Description:** Receives inventory adjustment updates from Odoo ERP and updates website stock counters instantly.
- **Payload Example:**
  ```json
  {
    "sku": "CPU-INTEL-14700K",
    "new_stock_qty": 12,
    "timestamp": 1718920500
  }
  ```

---
**End of Document**
