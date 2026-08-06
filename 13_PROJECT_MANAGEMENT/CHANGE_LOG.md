# Changelog (CHANGE_LOG.md)

**Document Classification:** Internal / Project Management & Version Control  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Guidelines
This document tracks all notable changes, feature additions, bug fixes, and architectural updates for the **Elitedom Store** e-commerce platform. The project adheres to [Semantic Versioning (SemVer)](https://semver.org/) and follows the [Keep a Changelog](https://keepachangelog.com/) standard.

---

## 2. Release History

### [2.1.0] - 2026-07-24 (Staging & Hardening Release)
#### Added
* Comprehensive operational documentation suite (`INCIDENT_RESPONSE.md`, `BACKUP_RECOVERY.md`, `MONITORING.md`, `MAINTENANCE.md`, `ROADMAP.md`, `RELEASE_PLAN.md`).
* Prometheus and Grafana telemetry container integration on Oracle Cloud VPS.
* Automated daily PostgreSQL backup and WAL archiving scripts with Sentry notification webhooks.

#### Changed
* Upgraded FastAPI rate-limiting middleware to protect checkout and authentication endpoints against brute-force attacks.
* Optimized database connection pooling parameters in SQLAlchemy for high concurrency.

#### Fixed
* Resolved intermittent Odoo webhook synchronization timeouts caused by network latency spikes.

---

### [2.0.0] - 2026-06-15 (ERP Integration & Staging Release)
#### Added
* Full bidirectional data synchronization between FastAPI backend and Odoo 17 Community ERP.
* Secure webhook signature validation middleware using `X-Elitedom-Signature` headers.
* Algolia real-time product search indexing and instant storefront search UI integration.
* Staging environment deployment on Oracle Cloud VPS (`staging.elitedom.store`) with SSL auto-renewal.

#### Changed
* Migrated primary data storage layer from SQLite (MVP) to PostgreSQL 15 production cluster.

---

### [1.1.0] - 2026-05-10 (Backend Core & Auth Enhancements)
#### Added
* JWT-based authentication system with Role-Based Access Control (RBAC) for Customers, Vendors, and Administrators.
* Automated inventory tracking logic linked to warehouse stock levels.

#### Fixed
* Resolved cart item duplication bug during simultaneous multi-device user sessions.

---

### [1.0.0] - 2026-03-01 (Initial MVP Release)
#### Added
* Initial project scaffolding and asynchronous FastAPI backend architecture.
* Basic product catalog management API and user registration endpoints.
* Docker and Docker Compose configuration for local development environments.

---
End of Document
