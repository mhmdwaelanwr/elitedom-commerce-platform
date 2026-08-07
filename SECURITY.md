# Security Policy

## Supported code

Security fixes target the current `main` branch and the release candidate currently being prepared for deployment. Historical stage documents and superseded decisions are not supported runtime versions.

## Reporting a vulnerability

Do **not** open a public issue containing exploitable details, secrets, personal data, or proof-of-concept material against a real deployment. Use GitHub's private vulnerability reporting or Security Advisory workflow for this repository when available to your account.

Include:

- affected component and commit/release;
- impact and prerequisites;
- minimal reproduction steps;
- whether credentials, PII, payments, authorization, webhooks, or infrastructure are involved;
- suggested mitigation if known.

## Security boundaries

The platform treats the following as security-sensitive boundaries:

- authentication sessions, OTP, OAuth and staff MFA;
- backend RBAC and audit logging;
- Paymob/Odoo/legacy Stripe webhook verification and idempotency;
- PostgreSQL and Redis credentials;
- provider and OAuth credentials;
- metrics access and observability endpoints;
- object storage/CDN configuration;
- admin/operations interfaces;
- production hosts, CORS, TLS and proxy trust.

## Secret handling

Never commit real secrets. Use `.env.example` as names-and-placeholder documentation only. Production credentials belong in an environment-specific secret manager or securely provisioned runtime environment.

If a secret is exposed, rotate/revoke it first; removing it from Git history is not sufficient by itself.

## Dependency and supply-chain changes

Pin or lock runtime dependencies according to the existing package-management strategy. Changes to base images, GitHub Actions, Python/Node dependencies, or provider SDKs require the same review and CI gates as application code.

## Production posture

Passing CI demonstrates repository correctness, not certification or production security approval. Launch requires environment-specific UAT, provider acceptance, backup/restore evidence, monitoring, and launch-control sign-off for the exact release reference.
