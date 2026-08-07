# Repository Scripts

Small, auditable command-line tools used by CI, launch operations, and repository governance.

## Inventory

| Script | Responsibility |
| --- | --- |
| `check_repository_hygiene.py` | Enforces canonical repository structure and rejects generated, retired, secret, and junk files. |
| `validate_documentation.py` | Enforces the enterprise Markdown/documentation truth contract. |
| `validate_launch_assets.py` | Verifies Stage 10 launch-control assets remain wired together. |
| `validate_odoo_addon.py` | Performs static Odoo addon structure and contract validation. |
| `live_smoke.py` | Runs guarded public-HTTPS storefront/API launch smoke checks. |

## Design rules

Repository scripts should be deterministic, non-interactive in CI, explicit about failures, and safe to run from a clean checkout. They must not depend on developer-specific paths or committed credentials.

A script that validates repository contracts should fail closed: a missing required asset or unverifiable condition is an error rather than an implicit pass.

Remote network validation must preserve the protections implemented by `live_smoke.py`, including public HTTPS requirements, private/reserved target rejection, DNS revalidation, and redirect failure behavior.

## Running locally

From `elitedom-store/`:

```bash
python3 scripts/check_repository_hygiene.py
python3 scripts/validate_documentation.py
python3 scripts/validate_launch_assets.py
python3 scripts/validate_odoo_addon.py
```

Run `live_smoke.py --help` before using it. Local-development exceptions must never be copied into the remote launch workflow.

## Change policy

When a script protects a CI or release contract, update the corresponding workflow and living documentation in the same pull request. Do not weaken a validation rule merely to make CI pass; correct the underlying repository state or intentionally change the documented contract.
