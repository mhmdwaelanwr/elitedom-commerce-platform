# =============================================================================
# Elitedom Store — Developer Makefile
# =============================================================================

.PHONY: help dev stop build logs logs-api test test-unit test-api lint lint-fix typecheck audit migrate migrate-new migrate-down seed admin-bootstrap shell db-shell app-db-shell redis-cli clean

DOCKER_COMPOSE ?= $(shell if docker compose version >/dev/null 2>&1; then printf '%s' 'docker compose'; elif docker-compose version >/dev/null 2>&1; then printf '%s' 'docker-compose'; else printf '%s' 'docker compose'; fi)
COMPOSE_DEV = $(DOCKER_COMPOSE) --env-file ../.env -f docker-compose.yml -f docker-compose.dev.yml

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────────────────────

dev: ## Start all services in development mode
	cd infrastructure && $(COMPOSE_DEV) up -d --build
	@echo "🚀 Services started:"
	@echo "   Storefront: http://localhost:3000"
	@echo "   FastAPI:    http://localhost:8000"
	@echo "   Swagger:    http://localhost:8000/docs"
	@echo "   Odoo:       http://localhost:8069"
	@echo "   PostgreSQL: localhost:5432"
	@echo "   Redis:      localhost:6379"

stop: ## Stop all services
	cd infrastructure && $(COMPOSE_DEV) down

build: ## Rebuild all containers
	cd infrastructure && $(COMPOSE_DEV) build --no-cache

logs: ## Tail logs for all services
	cd infrastructure && $(COMPOSE_DEV) logs -f

logs-api: ## Tail FastAPI logs only
	cd infrastructure && $(COMPOSE_DEV) logs -f fastapi

# ── Database ─────────────────────────────────────────────────────────────────

migrate: ## Run database migrations
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic upgrade head'

migrate-new: ## Create a new migration (usage: make migrate-new MSG="add users")
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic revision --autogenerate -m "$(MSG)"'

migrate-down: ## Rollback last migration
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic downgrade -1'

seed: ## Insert a non-destructive local demo catalog (development only)
	cd infrastructure && $(COMPOSE_DEV) exec -e DEBUG=false -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.seed_demo'

admin-bootstrap: ## Interactively create one non-default development system administrator
	cd infrastructure && $(COMPOSE_DEV) exec -it -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.bootstrap_admin'

# ── Testing ──────────────────────────────────────────────────────────────────

test: ## Run all tests with coverage
	cd backend && pytest -v --cov=app --cov-report=html

test-unit: ## Run unit tests only
	cd backend && pytest app/tests/unit -v

test-api: ## Run API integration tests
	cd backend && pytest app/tests/api -v

# ── Code Quality ─────────────────────────────────────────────────────────────

lint: ## Run linter (ruff)
	cd backend && ruff check .

lint-fix: ## Auto-fix lint issues
	cd backend && ruff check . --fix

typecheck: ## Run type checker (mypy)
	cd backend && mypy app/

audit: ## Run security audit on dependencies
	cd backend && pip-audit -r requirements.txt

# ── Utilities ────────────────────────────────────────────────────────────────

shell: ## Open a Python shell inside the FastAPI container
	cd infrastructure && $(COMPOSE_DEV) exec fastapi python -c "import IPython; IPython.start_ipython()" 2>/dev/null || $(COMPOSE_DEV) exec fastapi python

db-shell: ## Open an Odoo PostgreSQL shell
	cd infrastructure && $(COMPOSE_DEV) exec postgres psql -U elitedom -d elitedom_db

app-db-shell: ## Open the Store API PostgreSQL shell
	cd infrastructure && $(COMPOSE_DEV) exec postgres sh -lc 'psql -U "$$POSTGRES_USER" -d "$${APP_POSTGRES_DB:-elitedom_store}"'

redis-cli: ## Open Redis CLI
	cd infrastructure && $(COMPOSE_DEV) exec redis redis-cli

clean: ## Remove all containers, volumes, and build artifacts
	cd infrastructure && $(COMPOSE_DEV) down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
