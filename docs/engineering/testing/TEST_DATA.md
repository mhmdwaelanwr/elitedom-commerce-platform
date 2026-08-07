---
title: "Test Data Policy"
status: current
owner: engineering
document_type: testing
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Fixtures, local seeding, demo catalogue behavior, provider test-data handling, or privacy rules change."
---

# Test Data Policy

## Purpose

Defines how automated fixtures, development seed data, provider sandbox references, media fixtures, and UAT evidence are created without introducing production secrets or customer data into the repository.

## Data classes

### Automated test fixtures

Tests may create deterministic users, products, orders, payments, roles, sessions, webhook payloads, launch evidence, and other domain data in isolated test databases. Fixtures must be self-contained and must not depend on a developer's existing database or execution order.

### Development seed data

`make seed` uses the repository's demo seeding path to create/refresh a local catalogue and related development-only mappings. Seed behavior must be idempotent, clearly non-production, and must not create a known production administrator password or enable external providers implicitly.

### Provider sandbox data

Provider IDs/transactions may be represented by syntactically valid placeholders in tests and documentation. Real merchant secrets, OAuth secrets, OTP auth tokens, webhook signing secrets, or private provider-dashboard links are not test data and must never be committed.

### Media fixtures

Image fixtures should be small, appropriately licensed/generated for project use, and pass the same decode/type/size/dimension validation expected from application uploads. Tests should avoid large binary fixtures when a minimal deterministic artifact is sufficient.

### UAT and launch evidence

Repository tests can use artificial evidence references. Real launch-control evidence should store only a non-secret identifier/reference and operator notes appropriate for audit; do not paste customer PII, credentials, recovery codes, or full provider payloads into Git.

## Invariants and controls

- Never copy production customer PII, credentials, access/refresh tokens, MFA recovery material, payment-card data, production webhook payloads, or provider secrets into fixtures.
- Use reserved/example domains and clearly artificial phone/provider identifiers when syntax requires realistic shapes.
- Tests must establish their own state and clean/isolate it through the test harness rather than depending on shared developer state.
- Seed data is development convenience, not migration/reference data for production.
- Authentication/authorization tests must exercise real backend permission/session boundaries rather than bypassing them with fixture-only shortcuts.
- Webhook tests must retain signature/idempotency behavior instead of disabling security checks globally.

## Source of truth

- `elitedom-store/backend/app/tests/`
- `elitedom-store/backend/app/scripts/seed_demo.py`
- `elitedom-store/.env.example`
- `elitedom-store/scripts/check_repository_hygiene.py`

## Verification

Run test suites against clean ephemeral state, run repository hygiene, and inspect fixtures/seeds for accidental secrets or production identifiers. CI should remain capable of completing without access to private merchant/provider accounts.

## Change policy

Update this policy with changes to seed behavior, fixture strategy, provider sandbox handling, media fixture rules, or launch/UAT evidence handling.
