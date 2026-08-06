# Production Deployment Architecture Specification (DEPLOYMENT_ARCHITECTURE.md)

**Document Classification:** Internal / Infrastructure  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target Environment:** Ubuntu Linux Production Server, Docker Engine, Docker Compose, Nginx, PostgreSQL 15, Redis 7, FastAPI, Odoo 17 ERP  

---

## 1. Executive Summary & Infrastructure Overview
This document outlines the end-to-end production deployment architecture for the **Elitedom Store** e-commerce platform and its deep integration with **Odoo 17 ERP**. The infrastructure is designed for high availability, zero-downtime deployments, secure container isolation, and robust background task processing on a dedicated Ubuntu Linux host environment.

---

## 2. Infrastructure Topology & Environment Specifications

### 2.1. Host Operating System
* **OS:** Ubuntu Linux (Long Term Support - LTS) running on dedicated cloud/bare-metal server infrastructure.
* **Kernel & System Tuning:** Optimized network stack parameters (`sysctl.conf`) for handling high concurrent WebSocket and HTTP/2 connections from e-commerce clients.

### 2.2. Service Component Layout
| Component | Role / Function | Container / Service Name | Internal Port |
| :--- | :--- | :--- | :--- |
| **Nginx** | Reverse Proxy, SSL Termination, Static Asset Caching | `elitedom-nginx` | 80, 443 |
| **FastAPI** | E-commerce Core Backend API | `elitedom-backend` | 8000 |
| **Odoo 17 ERP** | Enterprise Resource Planning & Inventory | `elitedom-odoo` | 8069 |
| **PostgreSQL 15** | Primary Relational Database for E-commerce & Odoo | `elitedom-postgres` | 5432 |
| **Redis 7** | Caching, Session Store, & Celery Broker | `elitedom-redis` | 6379 |
| **Celery Worker** | Asynchronous Background Tasks (Webhooks, Email, HCS) | `elitedom-celery` | N/A |

---

## 3. Containerization & Docker Compose Orchestration

All application services are containerized using Docker and orchestrated via a production `docker-compose.prod.yml` configuration file.

### 3.1. Sample Production Docker Compose File (`docker-compose.prod.yml`)
```yaml
version: '3.8'

networks:
  elitedom-net:
    driver: bridge

volumes:
  postgres_data:
  odoo_data:
  redis_data:

services:
  postgres:
    image: postgres:15-alpine
    container_name: elitedom-postgres
    restart: always
    environment:
      POSTGRES_DB: elitedom_db
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - elitedom-net

  redis:
    image: redis:7-alpine
    container_name: elitedom-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - elitedom-net

  backend:
    build: .
    container_name: elitedom-backend
    restart: always
    env_file: .env.production
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
    depends_on:
      - postgres
      - redis
    networks:
      - elitedom-net

  celery_worker:
    build: .
    container_name: elitedom-celery
    restart: always
    env_file: .env.production
    command: celery -A worker.celery_app worker --loglevel=info
    depends_on:
      - postgres
      - redis
    networks:
      - elitedom-net

  odoo:
    image: odoo:17.0
    container_name: elitedom-odoo
    restart: always
    environment:
      - HOST=postgres
      - USER=${DB_USER}
      - PASSWORD=${DB_PASSWORD}
    volumes:
      - odoo_data:/var/lib/odoo
    depends_on:
      - postgres
    networks:
      - elitedom-net

  nginx:
    image: nginx:alpine
    container_name: elitedom-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - odoo
    networks:
      - elitedom-net
```

---

## 4. Reverse Proxy & SSL/TLS Configuration (Nginx)

Nginx acts as the single entry point, handling SSL/TLS termination via Let's Encrypt certificates and routing traffic between the FastAPI core and Odoo 17 ERP.

* **Domain Routing:**
  * `https://elitedom.store` -> Routed to FastAPI backend.
  * `https://erp.elitedom.store` -> Routed to Odoo 17 ERP internal container port `8069`.
* **Security Headers:** Enforces HSTS, X-Frame-Options, X-Content-Type-Options, and Content Security Policy (CSP) in accordance with `API_SECURITY.md`.

---

## 5. Security, Firewall & Backup Strategy

* **UFW Firewall:** All host ports except `22` (SSH), `80` (HTTP), and `443` (HTTPS) are blocked externally. Internal communication occurs exclusively within the isolated Docker bridge network (`elitedom-net`).
* **Automated Backups:** Daily encrypted snapshots of PostgreSQL and Odoo filestores backed up to external cloud object storage.

---
End of Document
