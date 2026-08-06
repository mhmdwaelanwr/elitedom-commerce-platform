# Security Requirements Document (SRD) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Objectives
This document outlines the security, encryption, and data protection requirements for the **Elitedom Store** platform. It establishes mandatory security controls, cryptographic protocols, and compliance standards to protect customer data, institutional transactions, and enterprise ERP infrastructure against unauthorized access, breaches, and tampering.

---

## 2. Cryptography & Data Encryption
- **Encryption in Transit:**
  - All communication between client browsers, mobile applications, and backend servers is encrypted using **TLS 1.3**.
  - SSL certificates are managed via NameSSL integrated with Let's Encrypt for automated provisioning and renewal, terminated securely at the Nginx Proxy Manager reverse proxy.
- **Encryption at Rest:**
  - PostgreSQL database storage volumes and system block storage on Oracle Cloud Infrastructure are encrypted at rest.
  - Database backups managed by `linuxserver/duplicati` are compressed and encrypted using **AES-256** prior to transmission and storage on Scaleway hot storage.
- **Secrets & Credentials Management:**
  - Passwords, API keys, database credentials, and root secrets are strictly stored within **1Password** enterprise vaults and **Vaultwarden** for internal server credentials. Hardcoding secrets in source code repositories is strictly prohibited.

---

## 3. Authentication & Access Control
- **User Authentication & Password Policy:**
  - Passwords must comply with strict complexity rules (minimum 8 characters, combining uppercase, lowercase, numbers, and symbols) and are securely hashed using **Bcrypt/Argon2**.
  - API and user sessions utilize **JWT (JSON Web Tokens)** with short expiration windows paired with secure refresh token rotation.
  - Social login authentication via Google and Apple OAuth 2.0 adheres to secure token validation standards.
- **Role-Based Access Control (RBAC):**
  - The system enforces strict role segregation: `Customer`, `B2B_Client`, `Warehouse_Operator`, `Support_Agent`, and `Admin`. Each role restricts API endpoints and ERP control panel views based on the principle of least privilege.

---

## 4. Payment Security & PCI-DSS Compliance
- **Payment Processing:**
  - Elitedom Store does not store raw credit card numbers, CVV codes, or sensitive financial data on its servers. All credit card and payment processing are handled securely via **Stripe** hosted elements, ensuring full **PCI-DSS Compliance**.
- **Web3 Audit Trail (Hedera Network):**
  - Completed payment transaction payloads and receipts are hashed (SHA-256) and anchored onto the **Hedera Consensus Service (HCS)** to guarantee immutability, tamper-proof auditing, and verifiable transaction history.

---

## 5. API Security & Webhook Protection
- **Rate Limiting & DDoS Protection:**
  - Public API endpoints (specifically `/auth/login`, `/auth/register`, and search queries) are protected by rate-limiting mechanisms to prevent brute-force attacks, credential stuffing, and volumetric DDoS.
- **Webhook Security:**
  - All third-party webhooks (Odoo ERP inventory sync and automated supplier dropship PO routing) require cryptographic verification headers using **HMAC-SHA256 signatures** (`X-Elitedom-Signature`) to ensure request authenticity and prevent spoofing.

---

## 6. Infrastructure & Host Security
- **VPS Hardening:**
  - Oracle Cloud VPS instances running Ubuntu Linux are accessed exclusively via **Termius Pro** using SSH key-based authentication (password authentication is disabled). Firewalls (UFW) restrict open ports to strictly necessary services (HTTP/HTTPS/SSH).
- **Container Isolation (Sandbox Architecture):**
  - Docker Engine containerization isolates core services (`odoo`, `postgres`, `nginx-proxy-manager`, `portainer`) and separates legacy environments from modern runtimes to prevent lateral movement during security incidents.

---

## 7. Logging, Monitoring & Incident Detection
- **Real-Time Monitoring:** **DataDog** actively monitors container resource consumption and triggers proactive alerts for anomalous CPU/RAM spikes or service degradation.
- **Error Tracking & Auditing:** **Sentry** captures runtime exceptions within the Odoo application in real-time, while **Log DNA** indexes system logs and tracks security audit trails for intrusion detection.

---
**End of Document**
