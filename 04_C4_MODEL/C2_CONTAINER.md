# C2 Container Architecture - Elitedom Store

Document Classification: Internal  
Version: 1.0  
Status: Approved  
Owner: Solution Architecture  
Target System: Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Introduction & Purpose
This document defines the **Level 2 Container (C2)** architectural model for the **Elitedom Store** platform. It zooms into the software system boundary to identify the high-level containers (applications, data stores, micro-services, and client apps) that comprise the architecture, how they interact, and their underlying technologies.

---

## 2. Container Diagram (Mermaid)

```mermaid
C4Container
    title Container diagram for Elitedom Store Platform

    Person(customer, "Customer", "Browses catalog, places orders, manages cart via Web or Mobile app.")
    Person(admin, "Store Administrator", "Manages catalog, pricing, security, and reviews financial reports.")
    Person(warehouse, "Warehouse Staff", "Manages physical stock movements and order fulfillment.")

    System_Boundary(elitedom_boundary, "Elitedom Store Platform") {
        Container(web_storefront, "Web Storefront", "TypeScript, React / Next.js", "Provides a reactive, SEO-optimized e-commerce shopping experience in the browser.")
        Container(mobile_app, "Mobile Application", "Dart, Flutter", "Cross-platform mobile app for customers (shopping/tracking) and warehouse staff (inventory/fulfillment).")
        Container(api_gateway, "API Gateway & Middleware", "Python, FastAPI", "Handles authentication, request routing, rate limiting, and event-driven webhook processing.")
        Container(odoo_erp, "Odoo 17 ERP Backbone", "Python, Odoo 17 Framework", "Master system of record managing core business logic, inventory, procurement, sales, and accounting.")
        ContainerDb(postgresql, "PostgreSQL Database", "PostgreSQL 16", "Relational database storing transactional records, user accounts, and audit logs.")
    }

    System_Ext(stripe, "Stripe Payment Gateway", "Processes secure online payments.")
    System_Ext(twilio, "Twilio CPaaS", "Sends SMS alerts and OTP verification codes.")
    System_Ext(algolia, "Algolia Search", "Provides ultra-low latency product search and filtering.")
    System_Ext(sendgrid, "SendGrid Email", "Sends transactional emails and notifications.")

    Rel(customer, web_storefront, "Uses", "HTTPS")
    Rel(customer, mobile_app, "Uses", "HTTPS / JSON API")
    Rel(admin, oci_admin, "Configures ERP via", "HTTPS")
    Rel(warehouse, mobile_app, "Updates stock/fulfillment via", "HTTPS")

    Rel(web_storefront, api_gateway, "Makes API calls to", "HTTPS / JSON")
    Rel(mobile_app, api_gateway, "Makes API calls to", "HTTPS / JSON")
    
    Rel(api_gateway, odoo_erp, "Syncs orders, customers, and stock via", "XML-RPC / REST API")
    Rel(api_gateway, algolia, "Queries and syncs product search indices via", "HTTPS / REST API")
    Rel(odoo_erp, postgresql, "Reads/Writes transactional data via", "TCP / SQL")
    Rel(api_gateway, postgresql, "Reads/Writes middleware sessions/logs via", "TCP / SQL")

    Rel(api_gateway, stripe, "Authorizes payments and receives webhooks via", "REST API")
    Rel(api_gateway, twilio, "Dispatches SMS/OTP via", "REST API")
    Rel(api_gateway, sendgrid, "Dispatches emails via", "REST API")
```

---

## 3. Container Breakdown & Technologies

### 3.1 Web Storefront
* **Technology:** TypeScript, React / Next.js
* **Responsibility:** Provides the primary client-facing web application for product browsing, cart management, and checkout. Hosted as static/SSR assets on cloud infrastructure.

### 3.2 [PLANNED] Mobile Application
* **Technology:** Dart, Flutter
* **Responsibility:** Cross-platform mobile application supporting customer shopping and tracking, as well as dedicated interfaces for warehouse staff to manage picking, packing, and stock verification.

### 3.3 API Gateway & Middleware
* **Technology:** Python, FastAPI
* **Responsibility:** Acts as the entry point and middleware layer for client applications. Handles JWT authentication, request validation, rate limiting, and asynchronous event routing between third-party services and Odoo.

### 3.4 Odoo 17 ERP Backbone
* **Technology:** Python, Odoo 17 Framework, PostgreSQL
* **Responsibility:** Serves as the master backend for enterprise logic, including inventory valuation, multi-warehouse routing, dropshipping rules, purchase orders, sales ledgers, and accounting.

### 3.5 PostgreSQL Database
* **Technology:** PostgreSQL 16
* **Responsibility:** Persistent relational data store ensuring ACID compliance, relational integrity, and high-performance querying for Odoo and middleware services.

---
End of Document
