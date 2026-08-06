# Stage 1 — Safe Repository Cleanup and Structure Report

Baseline commit: `d4b2139a40920dc94c209a39619bd30208c33806`

Stage 1 reduces repository ambiguity and prevents generated or retired sources from returning. It deliberately avoids moving working backend modules, changing API contracts, altering the database, or mixing storefront redesign, authentication, payment, and permission features into a cleanup pull request.

## Audit method

Before deleting any source, the repository was checked for:

1. code-search references and imports;
2. CI path filters and working directories;
3. Docker build contexts and Compose service paths;
4. active package manifests and frontend dependencies;
5. Makefile and developer commands;
6. copied assets that are still referenced by the storefront or seed data;
7. tracked runtime, operating-system, cache, environment and generated files.

## Canonical executable project

The only executable commerce project retained by this repository is `elitedom-store/`:

- `backend/` — FastAPI application, workers, migrations and tests;
- `frontend/` — Next.js storefront and admin application;
- `infrastructure/` — Docker Compose topology;
- `odoo/` — Odoo 17 addons;
- `scripts/` — validation and developer tooling;
- `docs/` — implementation delivery reports.

The numbered root folders remain architecture and operational documentation and were not deleted.

## Removed source and files

### `nextjs-ecommerce-template-main/`

The standalone template application was removed because:

- it had its own unrelated `package.json`, lockfile, Redux, Sanity, NextAuth and Tailwind 3 dependency graph;
- the active application uses `elitedom-store/frontend/package.json` with Next.js 16, React 19 and Tailwind CSS 4;
- repository code search found no runtime, import, CI, Docker or Makefile dependency on the standalone directory;
- the only textual reference explained that required images had already been copied into the active frontend;
- keeping a second application made dependency audits, onboarding and ownership unclear;
- the imported source did not include a repository-level `LICENSE` file, so retaining the full unused source increased provenance risk without runtime value.

### Next.js starter assets

The following default create-next-app files were removed after code search found no references:

- `elitedom-store/frontend/public/file.svg`
- `elitedom-store/frontend/public/globe.svg`
- `elitedom-store/frontend/public/next.svg`
- `elitedom-store/frontend/public/vercel.svg`
- `elitedom-store/frontend/public/window.svg`

## Retained intentionally

### `elitedom-store/frontend/public/template/images/`

These assets remain because active storefront code, the local seed script and integration tests reference `/template/images/...` URLs. Removing them would break visible pages and seeded product images.

Their production usage rights still require an explicit commercial review. Source cleanup is not a substitute for asset licensing.

### Documentation folders

`00_PROJECT_FOUNDATION` through `18_COMPLIANCE` remain because they contain the project architecture, requirements, operations and governance corpus. Their claims will be reconciled with delivered code incrementally rather than deleted wholesale.

### Tool instruction files

`AGENTS.md` and `CLAUDE.md` remain. `CLAUDE.md` delegates to `AGENTS.md`; it is not an empty accidental file.

## Added safeguards

- A repository-wide `.gitignore` now covers secrets, Node/Next outputs, Python caches, local media, logs, editor files and Celery runtime state.
- `elitedom-store/.gitignore` now includes Ruff, mypy, expanded environment patterns, local media and additional Node caches.
- `scripts/check_repository_hygiene.py` validates the canonical project roots and fails when retired sources, starter assets, secrets, caches, local media or runtime state are tracked.
- A dedicated GitHub Actions workflow runs the hygiene check without installing project dependencies and watches the retired template path plus repository metadata.
- The root and frontend READMEs now identify the canonical source tree and distinguish delivered functionality from production launch requirements.

## Deferred restructuring

The following work remains intentionally deferred because it requires feature-level tests or API migration planning:

- splitting the large frontend API adapter into domain services;
- reorganizing route-specific components into feature folders;
- replacing static development catalogue data after all local test paths have live fixtures;
- removing Stripe-era modules during the Paymob migration;
- consolidating legacy architecture documentation and updating Stripe/Twilio/hosting ADRs;
- pruning individual vendored images only after generating a reliable asset-reference manifest;
- dependency upgrades and security remediation that alter lockfiles;
- operation-level RBAC restructuring.

These items should be delivered in focused pull requests rather than hidden inside repository cleanup.

## Database and configuration impact

- Database migrations: none.
- API contract changes: none.
- Environment variables added or renamed: none.
- Docker service topology changes: none.
- Package dependencies changed: none.

## Validation

Run locally from `elitedom-store/`:

```bash
python3 scripts/check_repository_hygiene.py
make validate-odoo

cd backend
python -m ruff check .
python -m pytest app/tests -q

cd ../frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions must also pass Odoo 17 addon installation/tests, PostgreSQL migration replay, development/production Docker Compose validation, and the dedicated repository hygiene job before Stage 1 is considered complete.
