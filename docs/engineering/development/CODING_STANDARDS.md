# Coding Standards (CODING_STANDARDS.md)

Document Classification: Internal / Software Engineering & Development Standards  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. General Python Standards
* PEP 8 Compliance: All Python code must strictly adhere to PEP 8 guidelines.
* Formatting Tools: Code must be formatted using `black` (line length: 88) and imports sorted using `isort` prior to committing.
* Type Hinting: Every function, method, and API endpoint MUST include explicit Python type hints for arguments and return types to ensure type safety.

## 2. FastAPI & Pydantic Standards
* Validation: Always use Pydantic v2 models (`BaseModel`) for validating incoming request bodies, query parameters, and serializing outgoing responses.
* Dependency Injection: Leverage FastAPI's `Depends` for reusable logic like database session management, JWT authentication, and pagination.
* Route Organization: Modularize API endpoints using `APIRouter`. Group related endpoints in separate files (e.g., `routers/products.py`, `routers/orders.py`).

## 3. Odoo 17 ERP Standards
* Standard Structure: Adhere to standard Odoo module architecture (models/, views/, security/, data/, controllers/).
* ORM Overrides: When overriding core ORM methods (`create`, `write`, `unlink`), always call `super()` and handle the returned recordset appropriately.
* Security & Access: Every new model must have corresponding access rights defined in `security/ir.model.access.csv`.
* Webhooks Controllers: Odoo controllers receiving payloads from FastAPI must validate the `X-Elitedom-Signature` header before processing.

## 4. Database & SQLAlchemy Standards
* Async Paradigm: Use `AsyncSession` for all database interactions to prevent blocking the ASGI server.
* Query Syntax: Utilize SQLAlchemy 2.0+ modern syntax (e.g., `select(Model).where(...)` instead of legacy `.query()` methods).
* Migrations: Never alter the database schema manually. All schema changes must be applied via Alembic auto-generated scripts (`alembic revision --autogenerate`).

## 5. Naming Conventions
* Variables & Functions: `snake_case`
* Classes & Models: `PascalCase`
* Constants & Environment Variables: `UPPER_SNAKE_CASE`

---
End of Document
