# System Configuration Management & Application Settings Specification (CONFIGURATION.md)

**Document Classification:** Internal / Architecture  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Core, Pydantic Settings, Docker Environment)  

---

## 1. Executive Summary & Configuration Philosophy
This document establishes the architectural standards for configuration management within the **Elitedom Store** backend platform. Utilizing **Pydantic v2 BaseSettings**, application settings enforce strict type validation, environment-variable ingestion, and immutable runtime states upon startup, ensuring seamless synchronization between FastAPI, PostgreSQL, Redis, Odoo 17 ERP, and external microservices.

---

## 2. Application Settings Architecture (`config.py`)

The configuration layer is modeled hierarchically using Pydantic classes to segregate domain-specific parameters cleanly.

### 2.1. Core Application Settings (`AppConfig`)
* **`PROJECT_NAME`**: String (`Elitedom Store API`)
* **`VERSION`**: String (`1.0.0`)
* **`API_PREFIX`**: String (`/api/v1`)
* **`ENVIRONMENT`**: Enum (`development`, `staging`, `production`)
* **`DEBUG`**: Boolean (`False` in production)

### 2.2. Database & Caching Configurations
* **`DATABASE_URL`**: Computed PostgreSQL connection string (`postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`)
* **`REDIS_URL`**: Redis broker string for caching and Celery queues (`redis://:password@elitedom-redis:6379/0`)
* **`REDIS_CACHE_TTL`**: Integer default TTL in seconds (`3600`)

### 2.3. Enterprise Resource Planning (Odoo 17) Integration Settings
* **`ODOO_URL`**: XML-RPC endpoint (`http://elitedom-odoo:8069`)
* **`ODOO_DB`**: Database instance identifier (`elitedom_odoo_prod`)
* **`ODOO_USERNAME`**: Admin integration account email/username
* **`ODOO_API_KEY`**: Secure XML-RPC integration key

### 2.4. Hedera Consensus Service (HCS) Settings
* **`HEDERA_NETWORK`**: Network type (`testnet` or `mainnet`)
* **`HEDERA_OPERATOR_ID`**: Account identifier (`0.0.xxxxx`)
* **`HEDERA_OPERATOR_KEY`**: Private key for transaction fee payer
* **`HEDERA_DEFAULT_TOPIC_ID`**: Default HCS topic ID for order audit logs (`0.0.4829192`)

---

## 3. Feature Flags & Runtime Switches

The configuration schema includes dynamic feature toggles managed via Redis/Environment variables to allow graceful degradation or feature rollouts without redeploying containers:

* **`FEATURE_HCS_AUDIT_ENABLED`**: Boolean (`True`) — Controls whether B2B order hashes are dispatched to Hedera HCS.
* **`FEATURE_ODOO_SYNC_ENABLED`**: Boolean (`True`) — Toggles real-time background sync for stock levels and order fulfillment.
* **`FEATURE_MAINTENANCE_MODE`**: Boolean (`False`) — Replaces API responses with HTTP 503 Maintenance payloads during scheduled infrastructure updates.

---

## 4. Logging & Telemetry Configuration

* **Log Format:** Structured JSON logging in production environments for seamless ingestion by centralized monitoring stacks.
* **Log Level:** Restricted to `INFO` or `WARNING` in production; `DEBUG` enabled exclusively when `DEBUG=True`.
* **Sentry Integration:** Optional error tracking configured via `SENTRY_DSN` for real-time exception reporting on unhandled FastAPI exceptions.

---

## 5. Validation & Startup Integrity
Upon application boot (`main.py`), Pydantic validates all environment variables against predefined types and constraints. If any required variable (such as `SECRET_KEY`, `DB_PASSWORD`, or `ODOO_API_KEY`) is missing or malformed, the application aborts startup immediately with a descriptive validation error to prevent running in an insecure or misconfigured state.

---
End of Document
