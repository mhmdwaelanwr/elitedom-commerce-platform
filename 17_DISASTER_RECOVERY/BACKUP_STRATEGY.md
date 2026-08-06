# Backup Strategy & Automation (BACKUP_STRATEGY.md)

Document Classification: Internal / Site Reliability Engineering & Security  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
This document outlines the automated backup strategy for the Elitedom Store platform. Regular, verified backups are our primary defense against data corruption, hardware failure, and catastrophic outages on our Oracle Cloud VPS infrastructure.

## 2. Backup Scope & Targets
* PostgreSQL Primary Database: Contains core user profiles, storefront orders, and application state.
* Odoo 17 ERP Database: Contains accounting, supply chain, warehouse inventory, and business logic configurations.
* Environment Secrets & Configuration: Encrypted backups of environment variables (`.env`), Nginx configurations, and Docker Compose scripts.
* Uploaded Media & Assets: Product images, attachments, and static assets stored on disk or object storage.

## 3. Backup Schedule & Retention Windows
* Hourly Incremental Backups: Captured every hour for PostgreSQL transaction logs (WAL files) to achieve the 15-minute RPO target. Retained for 7 days.
* Daily Full Snapshots: Automated full database dumps (compressed SQL / custom format) executed daily at 02:00 UTC. Retained for 30 days.
* Monthly Archives: Full system snapshots taken on the 1st of every month. Retained for 12 months to satisfy financial and statutory auditing requirements.

## 4. Off-Site Storage & Security
* All backup archives are automatically encrypted using AES-256 before being transferred securely to an isolated, secondary Oracle Cloud Object Storage bucket or external storage target.
* Access to backup buckets is restricted strictly through IAM policies and service account keys following the principle of least privilege.

---
End of Document
