# =============================================================================
# Elitedom Store — Developer Makefile
# =============================================================================

.PHONY: help dev stop build logs logs-api logs-odoo prod-config prod-up prod-down prod-logs prod-migrate prod-odoo-upgrade prod-odoo-smoke test test-unit test-api test-e2e lint lint-fix typecheck audit validate-odoo verify-repo migrate migrate-new migrate-down seed admin-bootstrap odoo-install-connector odoo-upgrade-connector odoo-smoke shell db-shell app-db-shell redis-cli clean

DOCKER_COMPOSE ?= $(shell if docker compose version >/dev/null 2>&1; then printf '%s' 'docker compose'; elif docker-compose version >/dev/null 2>&1; then printf '%s' 'docker-compose'; else printf '%s' 'docker compose'; fi)
COMPOSE_DEV = $(DOCKER_COMPOSE) --env-file ../.env -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD = $(DOCKER_COMPOSE) --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-26s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services in development mode
	cd infrastructure && $(COMPOSE_DEV) up -d --build
	@echo "🚀 Services started:"
	@echo "   Storefront: http://localhost:3000"
	@echo "   FastAPI:    http://localhost:8000"
	@echo "   Swagger:    http://localhost:8000/docs"
	@echo "   Odoo:       http://localhost:8069"

stop: ## Stop development services
	cd infrastructure && $(COMPOSE_DEV) down

build: ## Rebuild development containers
	cd infrastructure && $(COMPOSE_DEV) build --no-cache

logs: ## Tail development logs for all services
	cd infrastructure && $(COMPOSE_DEV) logs -f

logs-api: ## Tail FastAPI logs only
	cd infrastructure && $(COMPOSE_DEV) logs -f fastapi

logs-odoo: ## Tail Odoo and connector logs
	cd infrastructure && $(COMPOSE_DEV) logs -f odoo

prod-config: ## Validate the production Compose topology
	cd infrastructure && $(COMPOSE_PROD) config --quiet

prod-up: ## Build and start the production topology
	cd infrastructure && $(COMPOSE_PROD) up -d --build

prod-down: ## Stop the production topology
	cd infrastructure && $(COMPOSE_PROD) down

prod-logs: ## Tail production logs for all services
	cd infrastructure && $(COMPOSE_PROD) logs -f

prod-migrate: ## Run FastAPI database migrations in production
	cd infrastructure && $(COMPOSE_PROD) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic upgrade head'

prod-odoo-upgrade: ## Upgrade the bundled connector in the production Odoo database
	cd infrastructure && $(COMPOSE_PROD) run --rm --no-deps odoo -d "$${ODOO_DB:-elitedom_db}" -u elitedom_connector --stop-after-init --no-http

prod-odoo-smoke: ## Verify production Odoo auth and connector installation
	cd infrastructure && $(COMPOSE_PROD) exec -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.check_odoo'

migrate: ## Run database migrations
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic upgrade head'

migrate-new: ## Create a new migration (usage: make migrate-new MSG="add users")
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic revision --autogenerate -m "$(MSG)"'

migrate-down: ## Rollback last migration
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app alembic downgrade -1'

seed: ## Insert a non-destructive local demo catalog (development only)
	cd infrastructure && $(COMPOSE_DEV) exec -e DEBUG=false -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.seed_demo'

admin-bootstrap: ## Interactively create one development system administrator
	cd infrastructure && $(COMPOSE_DEV) exec -it -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.bootstrap_admin'

odoo-install-connector: ## Install the bundled connector into the configured Odoo database
	cd infrastructure && $(COMPOSE_DEV) run --rm --no-deps odoo -d "$${ODOO_DB:-elitedom_db}" -i elitedom_connector --stop-after-init --no-http

odoo-upgrade-connector: ## Upgrade the bundled connector after pulling changes
	cd infrastructure && $(COMPOSE_DEV) run --rm --no-deps odoo -d "$${ODOO_DB:-elitedom_db}" -u elitedom_connector --stop-after-init --no-http

odoo-smoke: ## Authenticate to Odoo and verify the connector is installed
	cd infrastructure && $(COMPOSE_DEV) exec -w /app fastapi sh -lc 'PYTHONPATH=/app python -m app.scripts.check_odoo'

test: ## Run all tests with coverage
	cd backend && pytest -v --cov=app --cov-report=html

test-unit: ## Run unit tests only
	cd backend && pytest app/tests/unit -v

test-api: ## Run API integration tests
	cd backend && pytest app/tests/api -v

test-e2e: ## Run checkout/payment/Odoo contract flow
	cd backend && pytest app/tests/integration/test_odoo_connector_contract.py -v

validate-odoo: ## Statically validate the Odoo 17 addon
	python scripts/validate_odoo_addon.py

verify-repo: ## Run repository, documentation, launch, and Odoo static contracts
	python3 scripts/check_repository_hygiene.py
	python3 scripts/validate_documentation.py
	python3 scripts/validate_launch_assets.py
	python3 scripts/validate_odoo_addon.py

lint: ## Run linter (ruff)
	cd backend && ruff check .

lint-fix: ## Auto-fix lint issues
	cd backend && ruff check . --fix

typecheck: ## Run type checker (mypy)
	cd backend && mypy app/

audit: ## Run security audit on dependencies
	cd backend && pip-audit -r requirements.txt

shell: ## Open a Python shell inside the FastAPI container
	cd infrastructure && $(COMPOSE_DEV) exec fastapi python

db-shell: ## Open an Odoo PostgreSQL shell
	cd infrastructure && $(COMPOSE_DEV) exec postgres sh -lc 'psql -U "$$POSTGRES_USER" -d "$${ODOO_DB:-elitedom_db}"'

app-db-shell: ## Open the Store API PostgreSQL shell
	cd infrastructure && $(COMPOSE_DEV) exec postgres sh -lc 'psql -U "$$POSTGRES_USER" -d "$${APP_POSTGRES_DB:-elitedom_store}"'

redis-cli: ## Open Redis CLI
	cd infrastructure && $(COMPOSE_DEV) exec redis redis-cli -a "$${REDIS_PASSWORD}"

clean: ## Remove development containers/volumes and generated build/test artifacts
	cd infrastructure && $(COMPOSE_DEV) down -v --remove-orphans
	find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -prune -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -prune -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/htmlcov backend/.coverage backend/coverage.xml
	rm -rf frontend/dist frontend/.vite
	find frontend -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true
