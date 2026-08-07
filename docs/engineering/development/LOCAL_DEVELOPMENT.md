# Local Development Setup (LOCAL_DEVELOPMENT.md)

Document Classification: Internal / Software Engineering & Environment Guide  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
This document provides the mandatory steps to bootstrap the Elitedom Store local development environment. The architecture relies heavily on Docker for infrastructure (PostgreSQL, Odoo 17, Redis) and native virtual environments for the FastAPI Python backend.

## 2. Prerequisites
Before proceeding, ensure the following dependencies are installed on your local machine:
* Python 3.11+
* Docker & Docker Compose (v2)
* Git
* Postgres Client (optional, for direct DB inspection)

## 3. Environment Configuration
1. Clone the repository: `git clone <repository_url> && cd elitedom-store`
2. Create and activate a Python virtual environment:
   - Linux/macOS: `python3 -m venv venv && source venv/bin/activate`
   - Windows: `python -m venv venv && venv\Scripts\activate`
3. Install backend dependencies: `pip install -r requirements.txt`
4. Setup Environment Variables: 
   - Copy the example environment file: `cp .env.example .env`
   - Fill in the required local development secrets (DO NOT commit this file).

## 4. Bootstrapping Infrastructure (Docker)
We use Docker Compose to spin up the Odoo ERP and PostgreSQL database locally.
1. Start the infrastructure in the background:
   `docker compose up -d`
2. Verify services are running:
   `docker compose ps`
3. Odoo will be accessible at: `http://localhost:8069`
4. PostgreSQL will be accessible on port `5432`.

## 5. Database Migrations (FastAPI / Alembic)
Before running the backend, ensure the database schema is up to date:
1. Run migrations: `alembic upgrade head`
2. If you modify SQLAlchemy models, generate a new migration: 
   `alembic revision --autogenerate -m "description_of_changes"`

## 6. Running the FastAPI Backend
With the database and Odoo running, start the FastAPI asynchronous server:
1. Execute Uvicorn: 
   `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
2. The API will be accessible at: `http://localhost:8000`
3. Interactive Swagger UI Documentation: `http://localhost:8000/docs`

## 7. Shutting Down & Cleanup
To stop development and tear down the infrastructure:
1. Stop Uvicorn using `CTRL+C`.
2. Stop Docker containers without deleting data: `docker compose stop`
3. To stop and completely remove containers/networks: `docker compose down`
4. To obliterate the database volume (WARNING: Data Loss): `docker compose down -v`

---
End of Document
