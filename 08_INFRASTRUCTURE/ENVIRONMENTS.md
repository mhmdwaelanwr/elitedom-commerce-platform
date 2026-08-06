# Environment Variables & Configuration Specification (ENVIRONMENTS.md)

**Document Classification:** Internal / Infrastructure  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Docker, Linux Environment)  

---

## 1. Executive Summary & Overview
This document specifies the environment configuration management rules, configuration tiers, and complete environment variable schema for the **Elitedom Store** platform. Proper environment isolation ensures that development, staging, and production secrets remain secure and separated in compliance with platform security standards (`API_SECURITY.md`).

---

## 2. Environment Tiers
* **`development`**: Local developer machines (Ubuntu/Linux/WSL) utilizing local database instances and debug flags enabled (`DEBUG=True`).
* **`staging`**: Pre-production replica server used for end-to-end integration testing and client review.
* **`production`**: Live production environment hosted on dedicated Ubuntu infrastructure with strict security hardening, zero debugging, and persistent volume backing.

---

## 3. Environment Variables Schema (`.env.production`)

The table below lists all required environment variables categorized by service domain:

| Variable Name | Scope | Description / Example Value |
| :--- | :--- | :--- |
| **`ENVIRONMENT`** | Global | Deployment tier (`production`, `staging`, `development`) |
| **`DEBUG`** | Global | Debug logging flag (`False` in production) |
| **`SECRET_KEY`** | FastAPI | Cryptographic secret key for session tokens and JWT signing |
| **`DB_HOST`** | PostgreSQL | Database host address (`elitedom-postgres`) |
| **`DB_PORT`** | PostgreSQL | Database port (`5432`) |
| **`DB_NAME`** | PostgreSQL | Target database name (`elitedom_db`) |
| **`DB_USER`** | PostgreSQL | Database username (`postgres`) |
| **`DB_PASSWORD`** | PostgreSQL | Secure master database password |
| **`REDIS_URL`** | Redis / Celery | Redis broker connection string (`redis://:password@elitedom-redis:6379/0`) |
| **`ZEPTOMAIL_API_TOKEN`** | ZeptoMail | Send Mail API authorization token (`Zoho-enczapikey ...`) |
| **`HEDERA_OPERATOR_ID`** | Hedera HCS | Hedera account operator ID (`0.0.xxxxx`) |
| **`HEDERA_OPERATOR_KEY`** | Hedera HCS | Hedera operator private ECDSA/ED25519 key |
| **`ODOO_URL`** | Odoo 17 ERP | Internal XML-RPC endpoint for Odoo sync (`http://elitedom-odoo:8069`) |
| **`ODOO_DB`** | Odoo 17 ERP | Odoo database name (`elitedom_odoo_prod`) |
| **`ODOO_API_KEY`** | Odoo 17 ERP | XML-RPC admin integration token |

---

## 4. Configuration Security & Management Rules
1. **No Hardcoding:** Hardcoding secrets or API credentials inside source code repositories is strictly forbidden. All configuration must be ingested via environment variables or encrypted secrets managers.
2. **File Permissions:** `.env` files located on production hosts must have strict file permissions (`chmod 600`) restricting read access solely to the root or designated application service user.
3. **Vault Rotation:** External integration tokens (ZeptoMail, Hedera, Payment Gateways) must be audited and rotated semi-annually.

---
End of Document
