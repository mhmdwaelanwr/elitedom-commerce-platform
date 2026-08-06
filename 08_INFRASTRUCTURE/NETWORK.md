# Network Topology & Port Mapping Specification (NETWORK.md)

**Document Classification:** Internal / Infrastructure  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (Ubuntu Linux Host, Docker Bridge Networks, Nginx Reverse Proxy)  

---

## 1. Executive Summary & Overview
This document defines the network topology, port allocations, traffic routing rules, and firewall configurations for the **Elitedom Store** platform. It ensures secure isolation between public-facing ingress points and internal microservices, databases, and enterprise resource planning (ERP) containers.

---

## 2. Docker Network Topology (`elitedom-net`)
All containerized services communicate over an isolated Docker bridge network designated as `elitedom-net`. 
* **Network Driver:** `bridge`
* **Isolation Rule:** External access to backend databases, caches, and ERP internal ports is strictly prohibited. Only Nginx acts as the public gateway ingress point.

---

## 3. Port Mapping & Service Allocation Table

| Service Name | Container Name | Internal Port | External Port Exposure | Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Nginx (Ingress)** | `elitedom-nginx` | 80, 443 | 80, 443 | HTTP / HTTPS |
| **FastAPI Backend** | `elitedom-backend` | 8000 | None (Internal Only) | HTTP / REST |
| **Odoo 17 ERP** | `elitedom-odoo` | 8069 | None (Proxied via Nginx) | HTTP / XML-RPC |
| **PostgreSQL 15** | `elitedom-postgres` | 5432 | None (Internal Only) | TCP |
| **Redis 7** | `elitedom-redis` | 6379 | None (Internal Only) | TCP / RESP |

---

## 4. Ingress & Egress Traffic Routing

### 4.1. Ingress Routing (Client to Server)
* **`https://elitedom.store`**: Terminated at Nginx (`elitedom-nginx`) and reverse-proxied to the FastAPI e-commerce backend container (`elitedom-backend:8000`).
* **`https://erp.elitedom.store`**: Terminated at Nginx and reverse-proxied to the Odoo 17 ERP container (`elitedom-odoo:8069`).

### 4.2. Egress Routing (Server to External APIs)
* Outbound requests to third-party services (Zoho CRM, ZeptoMail, Hedera, Stripe, Twilio) utilize standard HTTPS (Port 443) governed by outbound firewall permissions on the Ubuntu host.

---

## 5. Host Firewall Configuration (UFW)
The Ubuntu host firewall (UFW) is configured to enforce strict perimeter security:
* **Allowed Inbound:** Port `22` (SSH - restricted by key), Port `80` (HTTP), Port `443` (HTTPS).
* **Denied Inbound:** All other ports (including database ports `5432`, `6379`, and internal app ports `8000`, `8069`).

---
End of Document
