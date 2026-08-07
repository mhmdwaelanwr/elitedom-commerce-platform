# API Security Strategy & Standards Document (API_SECURITY.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, PostgreSQL 15, Odoo REST/JSON-RPC)  

---

## 1. Executive Summary & Security Philosophy
This document establishes the mandatory security standards, protocols, and hardening practices governing all Application Programming Interfaces (APIs) within the **Elitedom Store** ecosystem. Given the platform's handling of multi-currency financial transactions, high-value hardware inventories, and backend integration with Odoo 17 ERP, a defense-in-depth security model is enforced across all endpoints.

The security framework adheres to industry benchmarks including **OWASP API Top 10**, **OWASP ASVS**, and the platform's core architecture principles (`AP-008 Security by Design`).

---

## 2. Authentication & Session Management

### 2.1. JSON Web Tokens (JWT) for Clients
* **Mechanism:** Stateless authentication utilizing cryptographically signed JWTs (RS256 algorithm).
* **Token Lifespan:** Short-lived Access Tokens (15 to 60 minutes) combined with securely stored, rotatable Refresh Tokens.
* **Storage:** Mobile clients and web frontends must store tokens securely (e.g., encrypted secure storage/HttpOnly cookies where applicable), strictly avoiding local storage for sensitive tokens.

### 2.2. API Keys & HMAC Signatures for Service-to-Service
* **Scope:** Communication between the FastAPI backend, Odoo 17 ERP, and third-party dropship suppliers.
* **Mechanism:** Every server-to-server request must include a cryptographic HMAC-SHA256 signature in the request headers (e.g., `X-Elitedom-Signature`) computed using a pre-shared secret key and request payload body.

---

## 3. Authorization & Access Control (RBAC)

* **Principle of Least Privilege:** Every API route enforces strict Role-Based Access Control (RBAC). Roles include `Customer`, `B2B_Client`, `Warehouse_Staff`, and `Administrator`.
* **Object-Level Authorization:** Endpoints accessing specific user resources (e.g., orders, RMA tickets, user profile data) must explicitly validate that the authenticated user owns the resource or holds administrative privileges, mitigating Insecure Direct Object References (IDOR - API1:2023).

---

## 4. Input Validation, Sanitization & Injection Defense

* **Strict Payload Validation:** All incoming request bodies, query parameters, and headers are strictly validated using **Pydantic** data models in FastAPI, rejecting unexpected fields or malformed types instantly.
* **SQL Injection Mitigation:** Direct SQL queries are strictly prohibited. All database interactions must flow through parameterized queries via Odoo ORM or SQLAlchemy, ensuring complete separation of code and data.
* **Payload Size Limits:** Request body size limits are enforced at the API gateway/reverse proxy layer to protect against denial-of-service (DoS) payloads and buffer overflow attempts.

---

## 5. Rate Limiting, Throttling & Abuse Prevention

To prevent brute-force attacks, credential stuffing, and scraping of the hardware catalog, rate limiting is enforced based on client IP addresses and user identifiers:
* **Authentication Routes (`/auth/login`, `/auth/register`):** Aggressive rate limits (e.g., max 5 attempts per minute) combined with exponential backoff or CAPTCHA triggers.
* **Public Search & Catalog (`/products`, `/products/search`):** Standard rate limits tailored to handle high traffic spikes without impacting legitimate shoppers.
* **Checkout & Payment (`/checkout/order`):** Monitored transaction velocity limits to detect fraudulent checkout attempts.

---

## 6. Transport Layer Security (TLS) & Encryption

* **HTTPS Enforcement:** All API traffic must be transmitted over **TLS 1.3 / TLS 1.2** with strong cipher suites. HTTP plaintext connections are automatically redirected to HTTPS.
* **HSTS Configuration:** HTTP Strict Transport Security (HSTS) headers are enforced across all domains to prevent protocol downgrade attacks.
* **Data at Rest:** Sensitive user data, payment gateway tokens, and authentication credentials are encrypted within the PostgreSQL database and Redis caching layers.

---

## 7. Webhook & Integration Security

* **IP Whitelisting:** Odoo ERP webhooks and automated supplier integration endpoints accept traffic exclusively from pre-approved, whitelisted server IP addresses.
* **Idempotency Keys:** Critical transactional webhooks (such as payment callbacks and inventory adjustments) require unique idempotency keys to protect against replay attacks.

---

## 8. Audit Logging & Immutable Tracking

* **Security Event Logging:** All authentication failures, permission violations, and administrative actions are logged with timestamps, source IPs, and user identifiers.
* **Blockchain Immutability (`elitedom.hedera.audit`):** High-value payment transactions and financial receipts are cryptographically hashed (SHA-256) and anchored onto the Hedera Consensus Service for tamper-proof verification.

---
End of Document
