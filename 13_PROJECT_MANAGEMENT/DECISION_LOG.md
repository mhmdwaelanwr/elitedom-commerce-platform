# Architecture Decision Log (DECISION_LOG.md)

**Document Classification:** Internal / Project Management & Architecture Governance  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Objectives
This document establishes the official Architectural Decision Record (ADR) log for the **Elitedom Store** e-commerce platform. It captures key technical, architectural, and operational decisions made by the engineering team, providing historical context, rationales, and trade-offs for future maintenance and scaling.

---

## 2. Decision Log Register

| ADR ID & Date | Title / Topic | Status | Context & Problem Statement | Decision & Solution | Consequences & Trade-offs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-001**<br>2026-03-01 | **Backend Framework Selection** | Accepted | Needed an asynchronous, high-performance web framework for the e-commerce API supporting auto-documentation and rapid schema validation. | Selected **FastAPI** coupled with Pydantic for request/response serialization and Uvicorn ASGI server. | **Pros:** High concurrency, automatic Swagger/OpenAPI docs, type safety.<br>**Cons:** Steeper learning curve for asynchronous database operations with SQLAlchemy. |
| **ADR-002**<br>2026-04-15 | **Database Layer Standardization** | Accepted | MVP used SQLite, which lacked concurrency support, robust relational constraints, and production scaling capabilities. | Migrated primary data storage to **PostgreSQL 15** with SQLAlchemy ORM and Alembic migrations. | **Pros:** ACID compliance, excellent concurrency, robust indexing.<br>**Cons:** Higher operational complexity compared to file-based databases. |
| **ADR-003**<br>2026-05-10 | **ERP Integration & Sync Strategy** | Accepted | Required seamless inventory and order synchronization between the storefront and enterprise resource planning. | Integrated **Odoo 17 Community Edition** via secure REST APIs and HMAC-SHA256 signed webhooks (`X-Elitedom-Signature`). | **Pros:** Centralized ERP accounting/inventory control, secure payload validation.<br>**Cons:** Requires careful handling of network latency and webhook retry queues. |
| **ADR-004**<br>2026-06-01 | **Hosting Infrastructure & Deployment** | Accepted | Needed cost-effective, reliable cloud hosting with root access and scalable resources for staging and production. | Deployed on **Oracle Cloud VPS** utilizing Docker and Docker Compose for containerized microservices. | **Pros:** High cost-efficiency, full infrastructure control, isolated containers.<br>**Cons:** Manual server hardening and backup configuration required. |
| **ADR-005**<br>2026-07-20 | **Telemetry & Monitoring Stack** | Accepted | Real-time visibility into infrastructure health, API performance bottlenecks, and system errors was lacking. | Implemented **Prometheus, Grafana, and Sentry** container monitoring on the Oracle Cloud VPS cluster. | **Pros:** Proactive alerting, comprehensive APM and resource tracking.<br>**Cons:** Additional resource overhead on the VPS. |

---

## 3. Governance & Amendment Process
* **Adding New ADRs:** Any major architectural change requires drafting a new ADR entry following the format above and submitting it for review during engineering syncs.
* **Immutability:** Once an ADR status is marked as **Accepted**, its core decision is immutable. Superseded decisions must be recorded as a new ADR referencing the prior ID.

---
End of Document
