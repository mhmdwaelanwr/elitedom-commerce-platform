# Contributing to Elitedom

Elitedom is maintained as a production-oriented modular commerce platform. Changes should preserve clear ownership boundaries, reversible database evolution and a green release baseline.

## Repository boundaries

The repository has three intentional top-level areas:

- `.github/` — automation and repository policy;
- `docs/` — product, architecture, engineering, operations and delivery knowledge;
- `elitedom-store/` — the canonical executable platform.

Do not add a new top-level directory simply to hold one feature, report or script. Put runtime work in the owning platform subsystem and documentation in the matching `docs/` domain. A genuinely new top-level boundary should be justified as an architectural decision.

## Runtime ownership

Inside `elitedom-store/`:

- `backend/` owns FastAPI, SQLAlchemy, Alembic, workers and backend tests;
- `frontend/` owns the Next.js storefront and admin application;
- `infrastructure/` owns Docker Compose and deployment topology;
- `odoo/` owns Odoo 17 addons;
- `scripts/` owns repository, smoke and integration validation tooling;
- `docs/` owns implementation-coupled runbooks and operational reports.

Keep business behavior inside its domain module. Avoid generic `utils` dumping grounds when the behavior has a clear owner.

## Documentation ownership

Use the semantic documentation tree described in [`docs/README.md`](docs/README.md). Do not recreate numbered root documentation directories. Historical delivery reports belong in `docs/delivery/releases/`.

ADRs are immutable historical decisions. When a decision changes, mark the old ADR as superseded and add a new decision rather than rewriting history.

## Branch and pull-request workflow

1. Start from the latest green `main`.
2. Use a focused branch such as `agent/<scope>`.
3. Keep one architectural concern per pull request.
4. Open the PR as Draft while implementation or CI repair is still in progress.
5. Fix the root cause of CI failures; do not weaken linting, tests or migration checks.
6. Rebase or refresh only when needed to resolve a real divergence from `main`.

Never commit credentials, provider secrets, production tokens or customer data.

## Required validation

From `elitedom-store/`, use the narrowest relevant checks during development and the complete gates before merge:

```bash
python3 scripts/check_repository_hygiene.py
python3 scripts/validate_launch_assets.py

cd backend
python -m ruff check .
python -m pytest app/tests -q

cd ../frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

The GitHub CI baseline additionally validates:

- Backend on Python 3.11;
- Frontend on Node 22;
- Odoo 17 addon clean installation and tests;
- PostgreSQL fresh upgrade, latest downgrade/replay and full downgrade/replay;
- development and production Docker Compose topologies;
- launch-acceptance assets.

Repository Hygiene runs independently for structural policy.

## Database migrations

Every schema change must be represented by Alembic and remain valid for:

1. fresh database upgrade to head;
2. latest migration downgrade and replay;
3. full downgrade and replay.

Do not edit an already-merged migration to change production history. Add a new revision.

## Integrations and webhooks

External callbacks must fail closed, verify signatures/HMAC where applicable, and be idempotent. Network/provider errors must not silently turn a failed operation into success.

## Frontend quality

Changes must preserve English/Arabic behavior, RTL/LTR, light/dark/system themes, responsive layouts, loading/empty/error states, accessibility basics and locale-aware formatting.

## Definition of done

A change is complete when its code, tests, migrations, operational documentation and CI behavior agree. A merge is not equivalent to production go-live; live-provider and environment-specific acceptance is recorded through the launch-control workflow.
