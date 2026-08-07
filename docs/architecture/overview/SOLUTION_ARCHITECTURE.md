# Solution Architecture Document (SAD) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Purpose
This document defines the master infrastructure and solution architecture for the **Elitedom Store** platform. It details the underlying cloud infrastructure, containerized services, data backup strategies, white-labeling frameworks, communication pipelines, and monitoring tools required to deliver a secure, scalable, and high-performance e-commerce and ERP system.

---

## 2. Infrastructure & Security Architecture
- **Cloud Hosting / VPS:** Oracle Cloud Infrastructure running an Ubuntu Linux environment .
- **Secure Server Management:** Termius Pro utilizing the SSH protocol for encrypted administrative access .
- **Secrets Management:** 1Password enterprise vault to securely store API keys, database credentials, and root passwords .
- **Transport Security:** NameSSL integrated with Let's Encrypt for automated SSL certificate provisioning, deployment, and renewal .

---

## 3. The Container Arsenal (Docker & Docker-Compose)
The platform is fully containerized using Docker Engine and managed via `docker-compose.yml` .

### Core System
- **Odoo (`odoo:17.0`):** The core enterprise engine driving store management, inventory control, and Point of Sale (POS) .
- **Database (`postgres:15`):** The primary ACID-compliant relational database management system supporting the Odoo ERP .

### Management & Routing Gateways
- **Reverse Proxy (`jc21/nginx-proxy-manager`):** Handles incoming customer traffic, virtual host routing for `elitedom.store`, and automated SSL termination .
- **Container Management (`portainer/portainer-ce`):** Graphical User Interface (GUI) for seamless container monitoring, resource allocation, and lifecycle management .

### Environment Isolation (Sandbox Sandbox Architecture)
- Leverages Docker container isolation to run legacy runtimes (e.g., PHP 7.4) side-by-side with modern environments (e.g., PHP 8.2) without system conflicts, dependency clashes, or port binding interference .

---

## 4. The 3-Tier Backup & Disaster Recovery System
- **Layer 1: Hot Storage (Active Backup)**
  - *Tool:* `linuxserver/duplicati` container .
  - *Process:* Automatically compresses and encrypts the database, uploading incremental backups to Scaleway (75GB Free Tier). Retains rolling backups and purges archives older than 30 days .
- **Layer 2: Cold Archive ("Old Gold")**
  - *Tool:* `nextcloud` container hosted on Oracle Cloud .
  - *Process:* Stores long-term strategic snapshots and system checkpoints every 6 to 9 months, acting as a redundant failsafe if Scaleway storage reaches capacity .
- **Layer 3: Decentralized Documentation & Web3 Audit**
  - *Tool:* `vaultwarden/server` container for secure internal credential management .
  - *Destination:* Stored on the Storj / Tardigrade decentralized cloud network .
  - *Process:* Archives operational receipts, employee access logs, and price catalogs. A custom Python script hashes completed payment transaction records onto the **Hedera network** to guarantee data immutability and prevent tampering .

---

## 5. White-Labeling, UI/UX & Development Workflows
- **Frontend (Customer-Facing Storefront):**
  - Uses internal QWeb/HTML editors to remove default "Powered by Odoo" branding and implement custom "Elitedom" copyright notices .
  - Designed with **Bootstrap Studio** to build a bespoke visual identity and responsive user interface .
  - Implements a hierarchical category tree (e.g., Motherboards, GPUs) and hardware variant chips .
  - Integrates the **Algolia Engine** for lightning-fast, typo-tolerant hardware catalog search .
- **Backend (Employee & Admin Control Panel):**
  - Installs Odoo Debranding modules (e.g., Muk IT) to replace default logos, remove watermarks, and customize color schemes .
- **Development & Hotfixing IDE:**
  - Deploys the `linuxserver/code-server` container to enable direct browser-based editing of Python source code and XML views when rapid hotfixes or deep customizations are required .

---

## 6. FinOps, Payments & Communications
- **Payment Processing:** Integrates **Stripe** with Odoo to process secure credit card transactions .
- **Transactional & Corporate Email:**
  - Domain linked to **Zoho Mail** with strict DNS security records (SPF, DKIM, DMARC) configured to ensure high inbox delivery rates .
  - Configured **SendGrid** as the primary SMTP relay within Odoo for automated receipts, invoices, and dispatch notifications .
- **Customer Communications & Forms:**
  - Integrates **Twilio** API for automated SMS notifications regarding order status updates and shipping approvals .
  - Utilizes **Typeform** for professional warranty registration, RMA (Return Merchandise Authorization) claims, and customer satisfaction surveys .

---

## 7. Monitoring, Logging & Analytics
- **Server & Container Monitoring:** **DataDog** monitors real-time CPU and RAM utilization across all containers, issuing proactive alerts prior to resource exhaustion or downtime .
- **Error Tracking:** **Sentry** integrated directly within the Odoo source code to capture, log, and trace runtime exceptions the moment a user encounters them .
- **Visitor Analytics:**
  - **SimpleAnalytics:** Cookieless, privacy-compliant tracking for visitor traffic and popular hardware products .
  - **FreshPaint:** Collects behavioral telemetry and clickstream data to generate marketing attribution reports .
- **Enterprise Data Integration:** Prepares **Talend** middleware pipelines to bridge the Odoo database with future external analytical or enterprise systems .

---
**End of Document**
