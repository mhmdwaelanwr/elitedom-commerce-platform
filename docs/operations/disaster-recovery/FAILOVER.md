# Failover Procedures & Architecture (FAILOVER.md)

Document Classification: Internal / Site Reliability Engineering & Operations  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Oracle Cloud VPS  

---

## 1. Overview
Failover is the automated or manual process of shifting system operations from a primary, failing infrastructure component (e.g., primary Oracle Cloud VPS instance or PostgreSQL database) to a secondary or backup environment to ensure high availability and minimize downtime for the Elitedom Store platform.

## 2. Failover Architecture & Triggers
* DNS Routing & Traffic Redirection: Managed via Cloudflare DNS / Oracle Cloud Load Balancer with automatic health checks pointing to `elitedom.store`.
* Database Replication: PostgreSQL primary streams write-ahead logs (WAL) to a warm standby replica in real-time.
* Automatic vs. Manual Failover:
  - Database Failover: Requires manual verification and promotion of the PostgreSQL replica to prevent split-brain scenarios.
  - Application Failover: Automated DNS health check failures trigger traffic redirection to a secondary replica VPS if the primary heartbeat fails for over 3 minutes.

## 3. Step-by-Step Database Failover Execution
1. Isolate Primary Node: Ensure the corrupted or failed primary PostgreSQL instance is completely cut off from network traffic.
2. Promote Standby Replica: Connect to the standby database server and promote it to primary:
   `pg_ctl promote -D /var/lib/postgresql/data`
3. Update Connection Strings: Update environment variables (`DATABASE_URL`) on the FastAPI backend and Odoo 17 instances to point to the new primary database IP/endpoint.
4. Restart Application Services:
   `docker compose restart fastapi-backend odoo`

## 4. Post-Failover Verification
* Verify write capabilities by submitting a test checkout or transaction on the staging/production interface.
* Check error logs across Sentry and Loki to ensure zero database connection leaks or replication lag errors.

---
End of Document
