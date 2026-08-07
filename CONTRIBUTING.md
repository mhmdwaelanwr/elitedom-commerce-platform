# Contributing to Elitedom

Elitedom is maintained as a production-oriented monorepo. Contributions must preserve runtime correctness, migration safety, documentation accuracy, and operational recoverability.

## Before starting

Use the structured GitHub issue forms for defects and feature proposals when work needs tracking. Security vulnerabilities must follow `SECURITY.md` and must not be disclosed through a public issue.

Start implementation only after understanding the affected runtime boundary, source-of-truth documentation, migration/provider implications, and rollback surface.

## Branch and pull-request workflow

1. Start from the latest green `main`.
2. Use a focused branch such as `agent/<scope>`, `feature/<scope>`, `fix/<scope>`, or `docs/<scope>`.
3. Keep unrelated behavior out of the same pull request.
4. Open a draft PR once the change is coherent enough for CI.
5. Fix root causes rather than weakening checks.
6. Use the pull-request template to record contracts, risk, verification, documentation, security, and rollback impact.
7. Merge only after required checks are green and review/approval policy is satisfied.

`CODEOWNERS` defines the current review ownership boundary. As the engineering organization grows, ownership should be split by domain rather than removed.

## Architectural boundaries

- `elitedom-store/backend/` owns application APIs, business rules, persistence, provider adapters, workers, and migrations.
- `elitedom-store/frontend/` owns browser UX and typed calls into backend contracts; it must not embed provider secrets or reimplement server-authoritative pricing/authorization.
- `elitedom-store/odoo/` owns the Odoo addon and outbound ERP events.
- `elitedom-store/infrastructure/` owns Docker Compose topology and deployment scripts.
- `elitedom-store/scripts/` owns deterministic repository/CI/launch validation tooling.
- `docs/` owns enterprise product, architecture, engineering, operations, governance, and release knowledge.
- `elitedom-store/docs/` contains executable implementation/runbook documentation close to the runtime.

Component-level READMEs are navigation aids. Living architecture and operations documentation remain authoritative for cross-component contracts.

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
- npm with `package-lock.json` is the canonical frontend package-manager contract unless an intentional repository-wide decision changes it.

## Dependency maintenance

Dependabot tracks npm, Python/pip, and GitHub Actions dependencies. Automated dependency PRs are still normal production changes: review release notes, run the full applicable CI surface, and do not merge incompatible major upgrades merely because the update was generated automatically.

## Documentation expectations

Living documentation must match code and configuration. Historical release records must remain historical. Superseded ADRs remain in place and point to the replacing decision.

Read `docs/governance/DOCUMENTATION_STANDARD.md` before changing the documentation corpus.

## Local verification

From `elitedom-store/`, run the repository contracts before pushing governance or structural changes:

```bash
make verify-repo
```

Then run the runtime checks applicable to the change, for example backend lint/tests, frontend verification/build, migration replay, Odoo validation/install tests, or Compose validation. CI remains authoritative for the required pull-request gate set.

Use `make clean` to remove local containers/volumes and generated Python/Next.js/test artifacts when validating a clean developer state.

## Security

Do not put secrets in commits, PR descriptions, screenshots, fixtures, or documentation. Use placeholders and environment-variable names only. Security concerns should be reported through GitHub's private vulnerability reporting/security advisory flow when available; see `SECURITY.md`.

## Repository hygiene

Do not commit generated caches, editor state, runtime logs, local media, coverage output, temporary conflict files, environment files, or package-manager artifacts outside their canonical package. Repository Hygiene enforces these rules in CI.

## Definition of done

A change is complete when implementation, tests, migrations, operational behavior, and documentation agree; all applicable CI jobs pass; rollback/recovery implications are understood; and no new secret, generated artifact, dead source tree, or misleading documentation is tracked.
