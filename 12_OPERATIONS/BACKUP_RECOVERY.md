# Backup & Disaster Recovery Plan (BACKUP_RECOVERY.md)

**Document Classification:** Internal / DevOps & Business Continuity  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Objectives
This document defines the official Backup and Disaster Recovery (BDR) strategy for the **Elitedom Store** e-commerce platform. It establishes automated data protection policies, retention schedules, and step-by-step restoration procedures to ensure business continuity, data integrity, and rapid recovery from infrastructure failures, data corruption, or security breaches affecting the Oracle Cloud VPS environment.

---

## 2. Backup Scope & Data Assets
| Data Asset | Component / Source | Storage Location | Backup Mechanism |
| :--- | :--- | :--- | :--- |
| **Relational Database** | PostgreSQL 15 (`elitedom-db`) | Local VPS & Oracle Cloud Object Storage | Daily `pg_dumpall` compressed snapshots |
| **ERP Files & Assets** | Odoo 17 Filestore (`/var/lib/odoo`) | Oracle Cloud Object Storage | Daily incremental `tar` archive |
| **Environment & Secrets** | FastAPI & Odoo `.env` configs | Encrypted Vault / Secure Storage | Manual versioning on infrastructure change |
| **Search Index** | Algolia Indices | Algolia Cloud Infrastructure | Automated Cloud-side Snapshot (SaaS) |

---

## 3. Backup Schedule & Retention Policy
* **Frequency:** 
  * Full database dumps and file archives run automatically every day at 02:00 EET via cron job.
  * Write-Ahead Log (WAL) archiving runs continuously for point-in-time recovery (PITR).
* **Retention Tiers:**
  * **Local VPS Storage:** Retained for 7 rolling days (`/var/backups/elitedom/`).
  * **Off-Site Cloud Storage:** Replicated to Oracle Cloud Object Storage and retained for 30 days.
  * **Monthly Archives:** Retained for 12 months for compliance and auditing.

---

## 4. Disaster Recovery (DR) Scenarios & Step-by-Step Playbooks

### 4.1 Scenario A: PostgreSQL Database Corruption / Accidental Data Loss
* **Objective:** Restore the PostgreSQL database to a clean state or a specific point in time prior to the incident.
* **Restoration Steps:**
  1. Stop active API and worker containers to prevent write anomalies:
     ```bash
     docker compose stop api odoo
     ```
  2. Drop and recreate the target database instance:
     ```bash
     docker exec -it elitedom-db psql -U postgres -c "DROP DATABASE elitedom_prod; CREATE DATABASE elitedom_prod;"
     ```
  3. Decompress and restore the latest verified backup:
     ```bash
     gunzip -c /var/backups/elitedom/db_YYYY-MM-DD.sql.gz | docker exec -i elitedom-db psql -U postgres elitedom_prod
     ```
  4. Run health check probes and restart services:
     ```bash
     docker compose start api odoo
     curl -s https://staging.elitedom.store/api/v1/health
     ```

### 4.2 Scenario B: Complete Oracle Cloud VPS Infrastructure Failure
* **Objective:** Provision a new VPS instance and rebuild the entire production/staging stack from scratch.
* **Restoration Steps:**
  1. Provision a fresh Ubuntu 22.04 LTS instance on Oracle Cloud Infrastructure (OCI).
  2. Install Docker, Docker Compose, and configure Nginx / Certbot SSL certificates.
  3. Clone the infrastructure and deployment repository from GitHub.
  4. Restore environment configuration files (`.env`) from secure credential storage.
  5. Pull latest Docker images, restore the PostgreSQL database and Odoo filestore from Oracle Cloud Object Storage backups, and execute `docker compose up -d`.

---

## 5. Verification & Disaster Recovery Drills
* **Automated Verification:** Backup script verifies integrity (`gzip -t`) immediately after creation and logs status to Sentry.
* **Quarterly Drills:** The DevOps team performs a full-scale dry run restoration on an isolated staging server every 3 months to validate RTO (Recovery Time Objective $< 2$ hours) and RPO (Recovery Point Objective $< 24$ hours).

---
End of Document
