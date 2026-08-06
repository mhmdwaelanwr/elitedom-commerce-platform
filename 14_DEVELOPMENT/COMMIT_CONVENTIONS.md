# Commit Conventions (COMMIT_CONVENTIONS.md)

Document Classification: Internal / Software Engineering & Version Control  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
The Elitedom Store engineering team strictly follows the Conventional Commits specification. This provides a clear, standardized commit history, making it easier to track changes, debug issues, and automate semantic versioning and changelog generation.

## 2. Commit Message Structure
Every commit message must be structured as follows:

<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>

## 3. Types
* feat: A new feature (correlates with MINOR in semantic versioning).
* fix: A bug fix (correlates with PATCH in semantic versioning).
* docs: Documentation changes only (e.g., updating README or markdown guidelines).
* style: Changes that do not affect the meaning of the code (white-space, formatting, etc).
* refactor: A code change that neither fixes a bug nor adds a feature.
* perf: A code change that improves performance.
* test: Adding missing tests or correcting existing tests.
* build: Changes that affect the build system or external dependencies (e.g., pip, docker).
* ci: Changes to our CI configuration files and scripts (e.g., GitHub Actions).
* chore: Other changes that don't modify src or test files.

## 4. Scopes
The scope should provide context to where the change was made. Common scopes for Elitedom include:
* (api): FastAPI endpoints, Pydantic models, FastAPI routers.
* (odoo): Odoo 17 modules, controllers, ORM overrides.
* (db): Alembic migrations, SQLAlchemy models, PostgreSQL config.
* (auth): JWT logic, security, dependencies.
* (infra): Docker, Nginx, deployment scripts.

## 5. Formatting Rules
* Subject Line: Must be written in the imperative mood (e.g., "add", not "added" or "adds"). Must not end with a period. Must not exceed 50 characters.
* Body: (Optional) Used to explain *what* and *why* instead of *how*. Wrap at 72 characters.
* Footer: (Optional) Used to reference issue tracker IDs (e.g., "Resolves: #123").

## 6. Examples
* feat(api): add endpoint for user profile retrieval
* fix(odoo): resolve webhook signature validation error
* chore(infra): update docker compose postgres version
* docs(guidelines): add commit conventions document

---
End of Document
