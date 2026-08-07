# Operational Runbook (RUNBOOK.md)

**Document Classification:** Internal / DevOps & System Engineering  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Algolia Search, Oracle Cloud VPS  

---

## 1. Executive Summary & Overview
This operational runbook provides sysadmins, DevOps engineers, and backend maintainers with standard operating procedures (SOPs), maintenance workflows, and emergency troubleshooting protocols for the **Elitedom Store** e-commerce platform hosted on Oracle Cloud VPS.

---

## 2. System Architecture & Service Map
| Component | Technology Stack | Deployment Model | Management Command / Access |
| :--- | :--- | :--- | :--- |
| **Storefront & API** | FastAPI (Python 3.11), Uvicorn | Docker Container (VPS) | `docker compose logs -f api` |
| **Database** | PostgreSQL 15 | Docker Container (VPS) | `docker exec -it elitedom-db psql -U postgres` |
| **ERP Backend** | Odoo 17 Community | Docker Container (VPS) | `docker compose logs -f odoo` |
| **Search Engine** | Algolia Cloud API | SaaS Integration | Algolia Dashboard / API Keys |
| **Reverse Proxy** | Nginx & Certbot (SSL) | Host System Service | `sudo systemctl status nginx` |

---

## 3. Routine Operational Procedures

### 3.1 System Health Checks
* **API Liveness Probe:** `curl -s https://elitedom.store/api/v1/health` (Expected response: `{"status": "healthy"}`)
* **Database Connection Check:** `docker exec -it elitedom-db pg_isready -U postgres`
* **Container Resource Monitoring:** Run `docker stats` to track real-time CPU and memory usage against established thresholds (CPU $< 85\%$, Memory $< 80\%$).

### 3.2 Backup & Disaster Recovery
* **PostgreSQL Automated Daily Backups:** Backups run daily at 02:00 EET via cron script:
  ```bash
  docker exec -t elitedom-db pg_dumpall -c -U postgres | gzip > /var/backups/elitedom/db_$(date +%F).sql.gz
  ```
* **Retention Policy:** Local backups retained for 7 days; off-site replication to Oracle Cloud Object Storage retained for 30 days.

---

## 4. Incident Response & Troubleshooting Playbooks

### 4.1 Incident: Odoo ERP Webhook Synchronization Failure
* **Symptom:** Orders placed on storefront do not appear in Odoo 17 ERP; Sentry logs report HTTP 401 or timeout errors on webhook dispatch.
* **Diagnostic Steps:**
  1. Verify Odoo container status: `docker inspect -f '{{.State.Running}}' elitedom-odoo`
  2. Check shared secret and `X-Elitedom-Signature` header alignment in FastAPI environment variables.
* **Resolution:** Restart the webhook worker service: `docker compose restart api-worker` and clear the pending transaction queue.

### 4.2 Incident: High Database Concurrency & Connection Exhaustion
* **Symptom:** API requests timing out; PostgreSQL logs show `FATAL: remaining connection slots are reserved for non-supervising connections`.
* **Diagnostic Steps:** Check active connections:
  ```sql
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
  ```
* **Resolution:** Terminate idle long-running queries or restart connection pooler / FastAPI instances to release pooled connections.

---

## 5. Deployment & Rollback Procedures
* **Standard Deployment:** Triggered automatically via GitHub Actions CI/CD pipeline upon merging to `main` branch after passing all test suites.
* **Emergency Rollback:** If a deployment fails health checks on Oracle Cloud VPS:
  ```bash
  docker compose down
  docker tag elitedom/api:previous elitedom/api:latest
  docker compose up -d --force-recreate
  ```

---
End of Document
