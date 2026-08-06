# Release Plan (RELEASE_PLAN.md)

**Document Classification:** Internal / Project Management & Release Engineering  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Objectives
This document defines the official Release Plan for the **Elitedom Store** e-commerce platform. It outlines the release lifecycle, versioning strategy, gate reviews, pre-deployment checklists, execution steps, and rollback protocols to ensure seamless code promotions from development to staging and production environments on Oracle Cloud VPS.

---

## 2. Versioning Strategy & Release Types
* **Semantic Versioning (SemVer):** Releases follow the `MAJOR.MINOR.PATCH` format (e.g., `v2.1.0`).
  * **MAJOR (`x.0.0`):** Incompatible API changes, major architectural refactors, or breaking database migrations.
  * **MINOR (`0.x.0`):** New functional features, Odoo integration enhancements, or backward-compatible API additions.
  * **PATCH (`0.0.x`):** Bug fixes, security patches, performance tuning, and minor dependency updates.

---

## 3. Release Lifecycle & Verification Gates

| Stage | Environment | Purpose & Gate Criteria | Approver / Owner |
| :--- | :--- | :--- | :--- |
| **1. Integration** | Local / CI (`main`) | Automated unit tests, linting, security vulnerability scans (`pip-audit`). | CI/CD Pipeline / Automated |
| **2. Staging** | `staging.elitedom.store` | End-to-end integration testing, Odoo webhook verification, UAT sign-off. | QA Lead / Backend Lead |
| **3. Production** | `elitedom.store` | Live deployment on Oracle Cloud VPS, final health check validation, DNS routing. | DevOps Lead / CTO |

---

## 4. Pre-Deployment Checklist
* [ ] All pull requests merged into `main` branch and passing GitHub Actions CI checks.
* [ ] Database migration scripts (`Alembic`) verified and tested against a staging database clone.
* [ ] Environment variables (`.env`, secrets, API keys) audited and synced securely.
* [ ] Automated database backup verified (`/var/backups/elitedom/`).
* [ ] Stakeholders and support teams notified of maintenance/release window via status page.

---

## 5. Deployment Execution Workflow
1. **Maintenance Mode Activation (if required):**
   ```bash
   sudo nginx -s reload # Route traffic to maintenance landing page if major DB schema changes occur
   ```
2. **Code Pull & Image Build:**
   ```bash
   git pull origin main
   docker compose build --no-cache
   ```
3. **Database Migrations:**
   ```bash
   docker exec -it elitedom-api alembic upgrade head
   ```
4. **Service Restart & Health Verification:**
   ```bash
   docker compose up -d --force-recreate
   curl -s https://elitedom.store/api/v1/health
   ```

---

## 6. Emergency Rollback Protocol
If critical failures occur post-deployment:
1. Revert Docker container tags to the previous stable release:
   ```bash
   docker compose down
   docker tag elitedom/api:previous elitedom/api:latest
   docker compose up -d --force-recreate
   ```
2. If database schema rollback is required, execute down-migration:
   ```bash
   docker exec -it elitedom-api alembic downgrade -1
   ```
3. Notify engineering team via Slack and log incident in Sentry.

---
End of Document
