# Stage 9 — Security, Performance, SEO & Production Hardening

Stage 9 turns the Stage 8 commerce/catalogue baseline into a deployment-hardened application without changing order, inventory, payment, or Odoo business semantics.

## Staff multi-factor authentication

Privileged staff access now supports TOTP MFA with single-use recovery codes.

Security properties:

- `STAFF_MFA_REQUIRED=true` is mandatory in staging and production configuration.
- permission checks still re-read persisted staff role and permission overrides from PostgreSQL; JWT role claims are not authoritative.
- when MFA policy is enabled, every `require_permission(...)` check also requires the current tracked `AuthSession` to have completed MFA.
- TOTP uses 30-second, six-digit codes with a one-window clock-skew allowance.
- TOTP seeds are encrypted at rest using Fernet with an application-context key derived from `SECRET_KEY`.
- recovery codes are random, stored only as keyed SHA-256 hashes, and consumed once.
- the raw TOTP seed is returned only during enrollment; raw recovery codes are returned only when enrollment is confirmed.
- MFA/OTP/auth responses that can contain credentials use `Cache-Control: no-store`.
- MFA enrollment and verification have stricter rate-limit budgets.

New endpoints:

- `GET /api/v1/auth/mfa/status`
- `POST /api/v1/auth/mfa/enroll`
- `POST /api/v1/auth/mfa/confirm`
- `POST /api/v1/auth/mfa/verify`

The frontend adds `/mfa` with Arabic/English guidance, authenticator setup, verification, and one-time recovery-code display. The admin layout performs an MFA preflight before loading the control plane.

## Distributed rate limiting

The previous process-local limiter is retained only for development. Staging and production require:

`RATE_LIMIT_BACKEND=redis`

The Redis limiter:

- uses an atomic `INCR` + expiry Lua operation,
- hashes client IPs before constructing Redis keys,
- trusts `X-Forwarded-For` only when the direct peer is in `TRUSTED_PROXY_IPS`,
- applies tighter budgets to login, OTP, MFA, and refresh endpoints,
- returns `Retry-After` and rate-limit headers,
- fails closed with HTTP 503 if a configured Redis protection backend is unavailable.

## Metrics, logging, tracing, and health

Existing structured JSON logging, request IDs, PII redaction, Prometheus metrics, and OpenTelemetry instrumentation remain in place.

Stage 9 adds:

- bearer authentication for `/metrics` outside an explicitly unprotected local-development configuration,
- mandatory strong `METRICS_BEARER_TOKEN` when metrics are enabled in staging/production,
- `/health/live` process liveness,
- `/health/ready` dependency readiness for PostgreSQL and Redis with bounded timeouts,
- safe dependency status only; connection strings and credentials are never returned.

## HTTP and deployment hardening

The API now emits defensive headers including:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Resource-Policy`
- restrictive API CSP outside development
- HSTS in production

The Next.js storefront adds corresponding browser headers while retaining OAuth popup compatibility.

Staging/production configuration validation now refuses startup when:

- debug is enabled,
- wildcard hosts or CORS origins are configured,
- staff MFA is not mandatory,
- the rate limiter is not Redis-backed,
- required application/database/Redis/metrics secrets are missing, weak, or placeholder values,
- enabled integration configuration is incomplete,
- object-storage/CDN URLs violate the environment security policy.

## Product media scale path

Stage 8's transaction-aware media boundary now supports:

- `MEDIA_STORAGE_PROVIDER=local`
- `MEDIA_STORAGE_PROVIDER=s3`

The S3 path uses the standard AWS credential/provider chain and supports S3-compatible endpoints. Credentials are not added to application configuration or source control.

For S3 media:

- the same JPEG/PNG/WebP decoding, MIME, size, dimension, pixel, and SHA-256 checks run before upload,
- uploads/deletes run outside the asyncio event loop,
- database rollback deletes newly-created objects,
- database commit deletes removed/replaced objects only after the transaction is durable,
- object deletion is best-effort after commit so a storage cleanup error cannot falsify an already-committed catalogue mutation,
- `MEDIA_CDN_BASE_URL` is required and must be HTTPS outside development,
- Next Image accepts only the explicitly configured API media origin and optional CDN origin.

Recommended production setup is private S3-compatible object storage behind a public HTTPS CDN with lifecycle/orphan cleanup policies.

## Storefront performance

Next.js image optimization is enabled rather than bypassed.

- generated formats include AVIF and WebP,
- remote image hosts are explicit rather than a wildcard HTTPS rule,
- compression remains enabled,
- production uses the standalone runtime image,
- dynamic sitemap catalogue requests are revalidated rather than fetched per crawler request without caching.

Stage 10 will establish measured performance budgets and load-test evidence; Stage 9 does not claim a traffic capacity without those results.

## SEO

The storefront now has:

- a configured public `metadataBase`,
- canonical URLs,
- title templates and social metadata,
- crawler policy through `robots.txt`,
- sensitive/non-public route exclusions (`/admin`, `/account`, `/checkout`, authentication and cart routes),
- dynamic `sitemap.xml` entries for published product slugs,
- product-specific title/description/Open Graph/Twitter metadata,
- no-index behavior for unavailable product routes,
- schema.org `Product` + `Offer` JSON-LD with EGP pricing and stock availability,
- safe JSON-LD escaping.

The public site URL is supplied with `NEXT_PUBLIC_SITE_URL`; production compose requires it.

## Migration

Alembic revision `0013_staff_mfa` follows `0012_catalog_content_media`.

It adds:

- `AuthSession.mfa_verified_at`
- `elitedom_admin_mfa_credential`

The migration is designed for the existing CI guarantees:

- fresh PostgreSQL upgrade,
- latest downgrade and replay,
- full downgrade and replay.

## Stage 10 boundary

Stage 9 hardens the implementation but does not replace launch acceptance. Stage 10 remains responsible for evidence and operational acceptance, including:

- end-to-end UAT across customer, B2B, staff, warehouse, finance, and support journeys,
- Paymob sandbox/manual merchant acceptance and production callback verification,
- production Google/Apple/Twilio configuration acceptance,
- load testing and performance budgets,
- security testing and vulnerability review,
- backup/restore and disaster-recovery exercises,
- observability alert routing and on-call runbooks,
- final production secrets/domain/TLS/CDN validation,
- launch checklist and rollback acceptance.
