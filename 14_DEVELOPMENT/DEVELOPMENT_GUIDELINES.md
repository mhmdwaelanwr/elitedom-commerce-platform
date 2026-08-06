# Development Guidelines (DEVELOPMENT_GUIDELINES.md)

Document Classification: Internal / Software Engineering & Development Standards  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Core Engineering Principles
This document outlines the mandatory development guidelines for the Elitedom Store platform. All software engineers, DevOps maintainers, and contributors must adhere to these foundational principles to ensure high performance, security, maintainability, and clean architectural patterns across the asynchronous FastAPI backend and Odoo 17 ERP integration.

### Core Philosophy
* Async-First Execution: Maximize non-blocking operations across DB queries, HTTP requests, and background tasks.
* Strict Type Safety: Leverage Python type hints and Pydantic v2 schemas to eliminate runtime payload failures.
* Security by Design: Enforce OWASP Top 10 defenses, zero-trust secrets handling, and signed webhook dispatches.
* ERP Integrity: Maintain bidirectional consistency between PostgreSQL, Algolia Search, and Odoo 17 modules.

---

## 2. Environment & Configuration Security

### 2.1 Secrets Management
* Zero Hardcoded Secrets: Never commit API keys, database credentials, or private signing keys to Git repositories.
* Centralized Vault Retrieval: Retrieve all production/staging secrets exclusively from 1Password or secure vault storage.
* Strict .env Isolation: Store runtime configurations in environment variables managed via a local .env file (strictly ignored in .gitignore).

### 2.2 System & Tooling Dependencies
* Python Runtime: Enforce Python 3.11+ across local environments and Docker containers.
* Containerization: All services must be fully executable locally via Docker Compose (docker compose up -d).

---

## 3. Backend Architecture & Coding Standards (FastAPI & SQLAlchemy)

### 3.1 Asynchronous Programming Rules
* Always use async/await for IO-bound operations (database queries, external API calls, HTTP clients).
* Use httpx.AsyncClient for outward HTTP dispatches (e.g., Algolia sync, Stripe webhooks, Odoo API calls). Never use blocking libraries like requests.

# GOOD: Non-blocking asynchronous HTTP request
async with httpx.AsyncClient() as client:
    response = await client.post(ODOO_WEBHOOK_URL, json=payload, headers=headers)

### 3.2 Database Layer & ORM Guidelines
* SQLAlchemy Async Session: Always manage database transactions via asynchronous session contexts (AsyncSession).
* Avoid N+1 Query Problems: Explicitly load relationships using selectinload() or joinedload().
* Database Migrations: Any schema change must be accompanied by a auto-generated and reviewed Alembic migration script (alembic revision --autogenerate -m "description").

---

## 4. ERP Integration & Webhook Dispatches (Odoo 17)

### 4.1 Cryptographic Signature Verification
* All incoming and outgoing webhooks between FastAPI and Odoo 17 must be verified using the X-Elitedom-Signature header (HMAC-SHA256).

# Mandated Signature Calculation Pattern
import hmac
import hashlib

def generate_signature(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()

### 4.2 Idempotency & Retry Queues
* All Odoo sync operations must be idempotent (safe to re-execute without creating duplicate records).
* Operations impacting external inventory or sales order states must log transaction state transitions and fail gracefully onto background worker queues.

---

## 5. Error Handling, Logging & Observability

### 5.1 Structured Exception Handling
* Throw HTTPExceptions using standard error response schemas.
* Never catch generic Exception without re-raising or logging context to Sentry.

from fastapi import HTTPException, status

if not product:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Product requested does not exist or has been unlisted."
    )

### 5.2 Telemetry & Monitoring Standards
* Error Tracking: Capture unhandled exceptions automatically via the Sentry SDK.
* Metrics: Expose Prometheus metric endpoints for HTTP request duration, DB connection pool state, and webhook dispatch latencies.

---

## 6. Code Formatting & Pre-Commit Enforcement
Prior to creating a Pull Request, code must pass automated linting and formatting:
* Formatter: black (line length: 88)
* Import Sorting: isort (configured with black profile)
* Vulnerability Scanning: pip-audit / safety

# Local Verification Commands
black .
isort .
pip-audit

---
End of Document
