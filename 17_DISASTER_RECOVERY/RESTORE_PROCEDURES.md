# Disaster Recovery Restore Procedures (RESTORE_PROCEDURES.md)

Document Classification: Internal / Site Reliability Engineering & Operations  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
This document defines step-by-step procedures for restoring the Elitedom Store platform from encrypted backups in the event of a disaster, data corruption, or infrastructure failure.

## 2. Prerequisites & Verification
* Ensure emergency access credentials to Oracle Cloud infrastructure and storage buckets are verified.
* Spin up a clean, isolated recovery VPS instance following the infrastructure provisioning guidelines.
* Download the latest verified full database dump and incremental logs from secure object storage.

## 3. PostgreSQL Database Restoration Steps
1. Stop running application containers to prevent write conflicts:
   `docker compose stop fastapi-backend odoo`
2. Drop and recreate the target PostgreSQL database instance:
   `psql -U postgres -c "DROP DATABASE elitedom_prod;"`
   `psql -U postgres -c "CREATE DATABASE elitedom_prod;"`
3. Restore the database from the compressed daily backup file:
   `pg_restore --no-owner -U postgres -d elitedom_prod /path/to/backup_dump.sql`
4. Apply WAL (Write-Ahead Log) archives if point-in-time recovery (PITR) is required to meet the 15-minute RPO.

## 4. Odoo 17 ERP Restoration Steps
1. Restore the Odoo filesystem filestore directory to `/var/lib/odoo/filestore`.
2. Restore the Odoo PostgreSQL database using standard `pg_restore` procedures.
3. Verify module dependencies, database states, and cron job configurations upon container startup.

## 5. Post-Restoration Validation
* Run database schema migrations (`alembic upgrade head`) to verify schema integrity.
* Execute health check endpoints on FastAPI (`/health`) and verify internal database connectivity.
* Test bidirectional webhook connectivity between FastAPI and Odoo 17 before switching DNS back to production routing.

---
End of Document
