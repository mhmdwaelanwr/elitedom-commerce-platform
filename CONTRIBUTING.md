# Contributing to Elitedom

Elitedom is maintained as a production-oriented monorepo. Contributions must preserve runtime correctness, migration safety, documentation accuracy, and operational recoverability.

## Branch and pull-request workflow

1. Start from the latest green `main`.
2. Use a focused branch such as `agent/<scope>`, `feature/<scope>`, `fix/<scope>`, or `docs/<scope>`.
3. Keep unrelated behavior out of the same pull request.
4. Open a draft PR once the change is coherent enough for CI.
5. Fix root causes rather than weakening checks.
6. Merge only after required checks are green and review/approval policy is satisfied.

## Architectural boundaries

- `elitedom-store/backend/` owns application APIs, business rules, persistence, provider adapters, workers, and migrations.
- `elitedom-store/frontend/` owns browser UX and typed calls into backend contracts; it must not embed provider secrets or reimplement server-authoritative pricing/authorization.
- `elitedom-store/odoo/` owns the Odoo addon and outbound ERP events.
- `elitedom-store/infrastructure/` owns Docker Compose topology and deployment scripts.
- `docs/` owns enterprise product, architecture, engineering, operations, governance, and release knowledge.
- `elitedom-store/docs/` contains executable implementation/runbook documentation close to the runtime.

## Backend expectations

- Python 3.11; Ruff must pass.
- Authorization is enforced in the backend, not inferred from UI visibility.
- Money, stock, discounts, shipping, payment transitions, refunds, and order state are server-authoritative.
- Webhooks require signature/HMAC verification where the provider supports it, idempotent receipt handling, and safe retry behavior.
- Background delivery uses transactional/outbox patterns where cross-system consistency matters.
- Sensitive endpoints and credentials fail closed.

## Database migrations

Every Alembic migration must support:

- upgrade from a fresh database to `head`;
- downgrade of the latest revision followed by replay;
- full downgrade to `base` followed by replay;
- deterministic constraints/index names;
- no hidden dependency on production-only data.

Schema migrations and ORM changes belong in the same PR.

## Frontend expectations

- Preserve English/Arabic, LTR/RTL, and light/dark/system preferences.
- Preserve responsive, loading, empty, error, focus, and keyboard-accessible states.
- Do not bypass typed backend adapters with provider-specific browser calls unless the architecture explicitly requires a public provider SDK.
- `npm run lint`, type checking, design-system checks, and production build must pass.

## Documentation expectations

Living documentation must match code and configuration. Historical release records must remain historical. Superseded ADRs remain in place and point to the replacing decision.

Read `docs/governance/DOCUMENTATION_STANDARD.md` before changing the documentation corpus.

## Security

Do not put secrets in commits, PR descriptions, screenshots, fixtures, or documentation. Use placeholders and environment-variable names only. Security concerns should be reported through GitHub's private vulnerability reporting/security advisory flow when available; see `SECURITY.md`.

## Definition of done

A change is complete when implementation, tests, migrations, operational behavior, and documentation agree; all applicable CI jobs pass; rollback/recovery implications are understood; and no new secret, generated artifact, dead source tree, or misleading documentation is tracked.
