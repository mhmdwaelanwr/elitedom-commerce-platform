# C4 Deployment Architecture - Elitedom Store

Document Classification: Internal  
Version: 1.0  
Status: Approved  
Owner: Solution Architecture  
Target System: Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Introduction & Purpose
This document defines the **Level 4 Deployment (C4)** architectural model for the **Elitedom Store** platform. It maps the software containers (Web Storefront, Mobile App Backend/Middleware, Odoo 17 ERP, PostgreSQL) onto the target physical and cloud infrastructure hosted on **Oracle Cloud Infrastructure (OCI)**.

---

## 2. Deployment Diagram (Mermaid)

```mermaid
C4Deployment
    title Deployment diagram for Elitedom Store Platform on Oracle Cloud Infrastructure (OCI)

    Deployment_Node(oci_region, "Oracle Cloud Infrastructure (OCI)", "Region: Frankfurt / Middle East (Cairo/UAE)") {
        Deployment_Node(vcn, "Virtual Cloud Network (VCN)", "Isolated Cloud Network") {
            
            Deployment_Node(public_subnet, "Public Subnet", "Internet Gateway & Load Balancer") {
                Container(lb, "OCI Load Balancer", "Nginx / OCI LBaaS", "Terminates SSL, routes incoming HTTPS traffic to web storefront and API gateway.")
            }

            Deployment_Node(private_app_subnet, "Private Application Subnet", "Secure Internal Network") {
                Deployment_Node(oke_cluster, "OCI Container Engine for Kubernetes (OKE)", "Docker / Kubernetes Cluster") {
                    Container(web_container, "Web Storefront Pods", "Next.js, Node.js", "Serves the reactive web storefront.")
                    Container(api_container, "API Gateway & Middleware Pods", "Python, FastAPI", "Handles business logic, middleware routing, and external API integrations.")
                    Container(odoo_container, "Odoo 17 ERP Pods", "Python, Odoo 17", "Runs core ERP backbone, inventory, sales, and accounting modules.")
                }
            }

            Deployment_Node(private_db_subnet, "Private Database Subnet", "Isolated Data Tier") {
                ContainerDb(db_instance, "OCI Base Database / PostgreSQL", "PostgreSQL 16 on OCI Compute / Managed DB", "Stores persistent relational data, transactional logs, and audit trails with WAL archiving.")
            }
        }
    }

    Deployment_Node(client_devices, "Client Devices & External Services", "Global Access") {
        Person(customer, "Customer / Staff", "Accesses via Web Browser or Flutter Mobile App.")
        System_Ext(stripe, "Stripe Payment Gateway", "External financial processing.")
        System_Ext(twilio_algolia, "Stripe / Twilio / Algolia / SendGrid", "SaaS Cloud APIs.")
    }

    Rel(customer, lb, "Sends HTTPS requests to", "TLS / Port 443")
    Rel(lb, web_container, "Routes web traffic to", "HTTP / Port 3000")
    Rel(lb, api_container, "Routes API traffic to", "HTTP / Port 8000")

    Rel(api_container, odoo_container, "Communicates internally via", "Internal RPC / REST")
    Rel(odoo_container, db_instance, "Reads/Writes transactions via", "TCP / PostgreSQL Port 5432")
    Rel(api_container, db_instance, "Reads/Writes sessions/logs via", "TCP / PostgreSQL Port 5432")

    Rel(api_container, stripe, "Calls API & receives webhooks via", "HTTPS")
    Rel(api_container, twilio_algolia, "Integrates with CPaaS & Search via", "HTTPS")
```

---

## 3. Infrastructure & Deployment Topology

### 3.1 Load Balancing & Edge Tier (Public Subnet)
* **OCI Load Balancer:** Terminates TLS/SSL certificates, handles incoming traffic distribution, DDoS protection, and routes requests to the internal private subnets based on path rules.

### 3.2 Application & Compute Tier (Private Application Subnet / OKE)
* **OCI Container Engine for Kubernetes (OKE):** Orchestrates containerized Docker images for the Web Storefront, FastAPI Middleware, and Odoo 17 ERP backbone.
* Autoscaling policies scale pod replicas dynamically based on CPU and request volume during peak shopping seasons.

### 3.3 Database Tier (Private Database Subnet)
* **PostgreSQL on OCI:** High-performance database instance deployed in an isolated private subnet with automated daily backups and continuous Write-Ahead Log (WAL) archiving to OCI Object Storage (as defined in ADR-009).

---
End of Document
