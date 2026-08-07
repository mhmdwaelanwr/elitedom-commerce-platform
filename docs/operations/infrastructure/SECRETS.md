# Secrets Management & Credential Security Specification (SECRETS.md)

**Document Classification:** Internal / Security & Infrastructure  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Docker, Linux Environment)  

---

## 1. Executive Summary & Security Philosophy
This document defines the policies, storage mechanisms, and lifecycle management rules for all sensitive credentials, private keys, and API tokens utilized within the **Elitedom Store** platform. Adhering to a strict zero-trust security posture, secrets must never reside in plain text within source code repositories, container images, or unsecured configuration files.

---

## 2. Classification of Sensitive Assets

Secrets managed within the platform are categorized into five primary tiers:

| Asset Category | Specific Secrets | Storage / Injection Method |
| :--- | :--- | :--- |
| **Database Credentials** | PostgreSQL master password, connection strings | Docker Compose Environment File (`.env.production`) |
| **Cryptographic Keys** | FastAPI `SECRET_KEY`, JWT signing keys, Hedera Operator Private Key | Secure Volume Mount / Environment Variables |
| **ERP Integration Tokens** | Odoo XML-RPC admin integration keys | Encrypted Secret Store |
| **Third-Party APIs** | ZeptoMail API tokens, Stripe/Payment keys, Twilio credentials | Environment Variables (`.env.production`) |
| **Cache & Broker Secrets** | Redis master AUTH password | Docker Secret / Environment Variable |

---

## 3. Storage & Access Control Policies

1. **Strict File Permissions:** On production Ubuntu Linux hosts, all `.env` files containing production secrets must enforce restricted POSIX file permissions:
   ```bash
   chmod 600 .env.production
   chown root:root .env.production
   ```
2. **Container Isolation:** Secrets are injected into containers at runtime via Docker environment files or secure volumes. They are strictly inaccessible from outside the isolated Docker bridge network (`elitedom-net`).
3. **Repository Exclusion:** All secret files (`.env`, `.env.production`, private key files `.pem`, `.key`) are explicitly listed in `.gitignore` to prevent accidental commits to version control.

---

## 4. Credential Rotation & Lifecycle Management

* **Rotation Schedule:** Critical secrets (such as database passwords, JWT signing keys, and payment gateway tokens) must be rotated semi-annually or immediately upon any suspected security perimeter breach.
* **Audit Logs:** Administrative access and secret retrieval operations are tracked through centralized system logs. Integration actions with the Hedera Consensus Service (HCS) maintain a cryptographic audit trail of critical transactions.

---

## 5. Incident Response for Compromised Secrets

In the event of a credential leak:
1. **Immediate Revocation:** Revoke the compromised API token or database user privileges instantly via the respective provider dashboard or database console.
2. **Key Regeneration:** Generate replacement credentials and update the production environment variables securely.
3. **Container Restart:** Restart affected container services (`elitedom-backend`, `elitedom-celery`, `elitedom-odoo`) to purge old memory state.
4. **Post-Incident Review:** Conduct a security audit to determine the vector of exposure.

---
End of Document
