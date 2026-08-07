# C1 System Context - Elitedom Store

Document Classification: Internal  
Version: 1.0  
Status: Approved  
Owner: Solution Architecture  
Target System: Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Introduction & Purpose
This document defines the Level 1 System Context (C1) diagram and narrative for the Elitedom Store platform using the C4 architectural model. It establishes the high-level boundary of the system, identifying the key human users (actors) who interact with it, and the external software systems it integrates with to deliver a complete e-commerce and enterprise resource planning solution.

---

## 2. System Context Diagram (Mermaid)

```mermaid
C4Context
    title System Context diagram for Elitedom Store Platform

    Person(customer, "Customer", "A user who browses products, searches the catalog, places online orders, and tracks shipments via Web or Mobile app.")
    Person(admin, "Store Administrator", "Manages product catalog, pricing, user roles, security, and reviews financial and inventory reports.")
    Person(warehouse, "Warehouse Staff", "Manages physical stock movements, picking, packing, and order fulfillment via mobile app and ERP interface.")
    Person(supplier, "Supplier / Vendor", "Provides external dropshipping product feeds and supplier fulfillment updates.")

    System_Boundary(elitedom_boundary, "Elitedom Store Platform") {
        System(elitedom_platform, "Elitedom Platform", "Modular monolith e-commerce storefront, mobile app backend, middleware, and Odoo 17 ERP backbone handling core business logic, inventory, and accounting.")
    }

    System_Ext(stripe, "Stripe Payment Gateway", "Processes secure online credit card transactions and checkout sessions.")
    System_Ext(twilio, "Twilio CPaaS", "Dispatches transactional SMS alerts and OTP verification codes.")
    System_Ext(algolia, "Algolia Search", "Provides ultra-low latency product catalog search and faceted filtering.")
    System_Ext(sendgrid, "SendGrid Email", "Sends transactional emails, order receipts, and shipping notifications.")
    System_Ext(oci, "Oracle Cloud Infrastructure", "Provides cloud compute, container orchestration (Kubernetes), PostgreSQL database hosting, and secure backup storage.")

    Rel(customer, elitedom_platform, "Browses catalog, searches, purchases, and tracks orders using", "HTTPS / JSON API")
    Rel(admin, elitedom_platform, "Configures business rules, catalogs, and ERP operations via", "HTTPS / Admin UI")
    Rel(warehouse, elitedom_platform, "Updates stock levels, verifies serial numbers, and processes fulfillment via", "HTTPS / Mobile App")
    Rel(supplier, elitedom_platform, "Sends dropship inventory data and updates via", "Webhooks / REST API")

    Rel(elitedom_platform, stripe, "Authorizes payments, captures charges, and receives webhooks via", "REST API")
    Rel(elitedom_platform, twilio, "Sends SMS and OTP verification messages via", "REST API")
    Rel(elitedom_platform, algolia, "Synchronizes product indices and queries search filters via", "REST API")
    Rel(elitedom_platform, sendgrid, "Dispatches transactional emails via", "REST API")
    Rel(elitedom_platform, oci, "Runs containerized workloads and archives database backups on", "OCI Cloud Services")
```

---

## 3. Scope and Boundaries

### 3.1 In Scope (The Elitedom Platform)
* Reactive Web Storefront & Mobile App: Client-facing applications allowing users to discover products, manage shopping carts, and execute secure checkouts.
* Middleware & Modular Monolith Backend: Custom Python application modules managing business domains, authentication, order processing, and event-driven communication.
* Odoo 17 ERP Backbone: The master system of record owning inventory management, procurement, sales orders, warehouse routing, and financial accounting.
* PostgreSQL Database: Primary relational data store managing all transactional records and audit logs.

### 3.2 Out of Scope (External Systems)
* Payment Processing (Stripe): Handling card tokenization, fraud detection, and banking transaction clearing.
* SMS & Communications (Twilio): Global carrier delivery of text messages and verification codes.
* Search Indexing (Algolia): External cloud-managed search index engine.
* Email Delivery (SendGrid): SMTP and API-based email dispatch infrastructure.
* Cloud Infrastructure (OCI): Virtual cloud networks, physical server hardware, and managed infrastructure services.

---
End of Document
