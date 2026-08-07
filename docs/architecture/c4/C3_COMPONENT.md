# C3 Component Architecture - Elitedom Store

Document Classification: Internal  
Version: 1.0  
Status: Approved  
Owner: Solution Architecture  
Target System: Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Introduction & Purpose
This document defines the **Level 3 Component (C3)** architectural model for the **Elitedom Store** platform. It zooms into the primary backend container (**API Gateway & Modular Monolith Middleware**) to reveal its internal components, modules, service boundaries, and how they interact with external systems and the Odoo 17 ERP backbone.

---

## 2. Component Diagram (Mermaid)

```mermaid
C4Component
    title Component diagram for API Gateway & Modular Monolith Backend

    Container(web_storefront, "Web Storefront", "TypeScript, React / Next.js", "Client web application.")
    Container(mobile_app, "Mobile Application", "Dart, Flutter", "Client mobile application.")

    Container_Boundary(api_gateway_boundary, "API Gateway & Modular Monolith Middleware (Python, FastAPI)") {
        Component(auth_comp, "Authentication & RBAC Module", "FastAPI Security, JWT", "Handles user sign-in, token generation, role-based access control (Customer, Admin, Warehouse).")
        Component(product_comp, "Product & Search Sync Module", "Python, Algolia SDK", "Manages catalog queries, syncs products and attributes with Algolia search index.")
        Component(order_comp, "Order Orchestration Module", "Python Business Logic", "Manages shopping carts, checkout validation, and coordinates order placement with Odoo ERP.")
        Component(payment_comp, "Payment Integration Module", "Stripe SDK, Webhook Handlers", "Processes checkout sessions, verifies payment tokens, and listens to asynchronous payment webhooks.")
        Component(inventory_comp, "Inventory & Hybrid Stock Module", "Odoo XML-RPC / REST Client", "Synchronizes hybrid stock levels, warehouse routing, and dropship statuses with Odoo 17.")
        Component(notification_comp, "Notification Dispatcher", "Twilio SDK, SendGrid SDK", "Dispatches transactional SMS, OTP codes, and email notifications asynchronously.")
    }

    Container(odoo_erp, "Odoo 17 ERP Backbone", "Python, Odoo 17", "Master system of record for accounting, inventory, and sales orders.")
    ContainerDb(postgresql, "PostgreSQL Database", "PostgreSQL 16", "Relational persistence layer.")

    System_Ext(stripe, "Stripe Payment Gateway", "Processes online payments.")
    System_Ext(twilio, "Twilio CPaaS", "Sends SMS/OTP.")
    System_Ext(algolia, "Algolia Search", "Provides search index.")
    System_Ext(sendgrid, "SendGrid Email", "Sends email receipts.")

    Rel(web_storefront, auth_comp, "Authenticates via", "HTTPS / JSON")
    Rel(mobile_app, auth_comp, "Authenticates via", "HTTPS / JSON")

    Rel(web_storefront, product_comp, "Searches products via", "HTTPS / JSON")
    Rel(mobile_app, product_comp, "Searches products via", "HTTPS / JSON")

    Rel(web_storefront, order_comp, "Manages cart/checkout via", "HTTPS / JSON")
    Rel(mobile_app, order_comp, "Manages cart/checkout via", "HTTPS / JSON")

    Rel(order_comp, payment_comp, "Initiates payment session via", "Internal Call")
    Rel(payment_comp, stripe, "Authorizes/Charges via", "REST API")
    Rel(stripe, payment_comp, "Sends webhook events to", "REST API")

    Rel(order_comp, odoo_erp, "Creates sales orders and invoices via", "XML-RPC")
    Rel(inventory_comp, odoo_erp, "Syncs multi-warehouse stock via", "XML-RPC")
    Rel(product_comp, algolia, "Queries / Syncs index via", "REST API")

    Rel(auth_comp, postgresql, "Reads/Writes user sessions via", "SQL")
    Rel(order_comp, postgresql, "Reads/Writes cache/logs via", "SQL")

    Rel(order_comp, notification_comp, "Triggers order alerts via", "Internal Call")
    Rel(notification_comp, twilio, "Sends SMS via", "REST API")
    Rel(notification_comp, sendgrid, "Sends Email via", "REST API")
```

---

## 3. Component Breakdown & Responsibilities

### 3.1 Authentication & RBAC Module
* **Technology:** FastAPI Security, PyJWT
* **Responsibility:** Manages user registration, login verification, JWT token issuance, and role-based access control ensuring strict permission segregation between Customers, Store Administrators, and Warehouse Staff.

### 3.2 Product & Search Sync Module
* **Technology:** Python, Algolia Python Client
* **Responsibility:** Handles product catalog requests, attribute filtering, and synchronizes product metadata and stock updates between Odoo 17 and Algolia search indices to ensure sub-100ms search latency.

### 3.3 Order Orchestration Module
* **Technology:** Python Business Logic Core
* **Responsibility:** Coordinates the end-to-end checkout flow, cart validation, price calculation, tax verification, and communicates with Odoo 17 to instantiate official sales orders and invoices.

### 3.4 Payment Integration Module
* **Technology:** Stripe Python SDK, Webhook Handlers
* **Responsibility:** Interacts with Stripe to create secure payment intents and checkout sessions, handling asynchronous webhook notifications (payment success, failure, refunds) to update order statuses.

### 3.5 Inventory & Hybrid Stock Module
* **Technology:** Odoo XML-RPC Client, Python Async Worker
* **Responsibility:** Manages the hybrid stock model, synchronizing real-time inventory counts between internal warehouses and dropship suppliers, and mapping stock movements within Odoo 17.

### 3.6 Notification Dispatcher
* **Technology:** Twilio SDK, SendGrid SDK, Celery / Async Workers
* **Responsibility:** Asynchronously dispatches transactional SMS alerts, OTP verification codes, and email receipts triggered by customer actions or order status updates.

---
End of Document
