# Elitedom Store — Go-Live Runbook

This runbook is the operational sequence for promoting a tested release candidate to production. It complements automated CI and the `/admin/launch` control plane. Never treat a green code CI run as proof that live payment, identity, messaging, DNS, storage, or monitoring providers are configured correctly.

## 1. Release ownership

Assign one release owner and one rollback owner before the change window. Record the candidate Git SHA, container/image identifiers if applicable, migration head, planned start time, and communication channel. The release owner owns the final go/no-go decision. The rollback owner must be able to restore the previous application revision without depending on the release owner.

## 2. Pre-deployment

Before changing production:

- confirm `main` is green on Backend, Frontend, Odoo 17, PostgreSQL migration smoke, Docker Compose, and Launch acceptance;
- confirm the candidate Git SHA is the exact SHA planned for deployment;
- confirm no newer migration or emergency change is unreviewed;
- generate strong, unique production secrets outside the repository;
- set `ENVIRONMENT=production`, `DEBUG=false`, `STAFF_MFA_REQUIRED=true`, and `RATE_LIMIT_BACKEND=redis`;
- configure explicit `ALLOWED_HOSTS` and HTTPS-only `CORS_ORIGINS`;
- confirm PostgreSQL and Odoo use different databases;
- configure metrics authentication and the selected observability exporter/alert routing;
- configure public storefront/API URLs, DNS, TLS certificates, and reverse-proxy routing;
- configure S3-compatible media storage/CDN if the production topology is multi-node or requires durable shared media;
- verify the Admin Launch Readiness page and note all current blockers/warnings.

Do not continue while a required automatic launch gate is blocked.

## 3. Database backup and restore

A backup is not accepted until a restore has been demonstrated.

1. Create an application PostgreSQL backup using the production-approved backup mechanism.
2. Record backup time, source database, retention location, encryption state, and non-secret backup identifier.
3. Restore the backup into an isolated fresh PostgreSQL database/server.
4. Start the application against the restored database with outbound providers disabled where appropriate.
5. Verify migration head, representative customer/order/catalog records, and `/health/ready`.
6. Record the restore evidence reference in the `backup_restore` launch gate.

Do not store database credentials, encryption keys, access tokens, or raw customer exports in the launch gate evidence or notes.

## 4. Migration deployment

- verify the production database backup/restore gate is passed;
- run Alembic upgrade to the exact release migration head;
- inspect the command result and current migration revision;
- do not run destructive manual SQL outside the reviewed migration chain;
- if migration fails, stop the release and follow the Rollback section before accepting traffic.

Stage 10 migration head is `0014_launch_acceptance` unless a later reviewed migration supersedes it.

## 5. Application deployment

Deploy the exact reviewed release revision. Start PostgreSQL/Redis dependencies, application database initialization, FastAPI, workers, frontend, Odoo, and reverse-proxy services according to the production topology.

Verify container/process health before exposing new traffic. A process being "running" is insufficient; dependency readiness must pass.

## 6. Provider acceptance

Use the real target configuration. Record only non-secret evidence references.

### Paymob

- perform an approved test/sandbox purchase through the production-equivalent checkout path;
- confirm redirect/callback URLs use public HTTPS;
- confirm signed webhook acceptance and idempotent replay behavior;
- verify the order/payment status in the application and administrative control plane;
- perform or verify a refund path and provider result;
- mark `paymob_live_flow` passed only after the full path succeeds.

### Google Sign-In

- test the configured web client and redirect origin;
- verify account creation/login and subsequent authenticated API access;
- mark `google_oauth_live` passed with a run/ticket reference.

### Apple Sign-In

- test the configured Service ID/client and callback;
- verify account creation/login and authenticated API access;
- mark `apple_oauth_live` passed.

### Twilio OTP

- send OTP to an approved real Egyptian test number;
- verify success, incorrect-code failure, retry behavior, expiry, and rate limiting;
- mark `twilio_otp_live` passed.

### Odoo

- verify product/order/stock synchronization in the target Odoo 17 instance;
- verify webhook signature handling and idempotent re-delivery;
- verify stock/order state remains consistent across retry;
- mark `odoo_round_trip` passed.

## 7. UAT

Complete both languages and representative devices before go-live.

### English flow

Browse catalog → search/filter → product detail → cart → sign-in/registration → checkout → payment initiation → order account view → admin order visibility.

Record the evidence reference in `uat_english`.

### Arabic / RTL flow

Repeat the same flow with Arabic active. Check RTL order, text alignment, controls, price/date/number presentation, long labels, validation messages, and no clipped layout.

Record the evidence reference in `uat_arabic_rtl`.

### Responsive and accessibility

Test representative mobile, tablet, and desktop widths. Verify keyboard navigation, visible focus, form labels, dialog/notification behavior, touch targets, image alternative text where applicable, and contrast spot checks.

Record the evidence reference in `responsive_accessibility`.

### Fulfillment and refund

Exercise reservation, fulfillment, shipment dispatch/delivery, return/RMA where applicable, refund request, and idempotent provider/webhook retry behavior. Record `fulfillment_refund`.

## 8. Smoke test

Run the GitHub Actions **Launch Smoke** workflow with the public storefront origin and public API origin. It must pass storefront, `robots.txt`, `sitemap.xml`, `/health/live`, `/health/ready`, and backend security-header checks.

Save the GitHub run URL/artifact reference in the release record. A failed external smoke is a release blocker.

For a local developer-operated check only:

```bash
python scripts/live_smoke.py \
  --site-url http://localhost:3000 \
  --api-url http://localhost:8000 \
  --allow-local
```

Never add `--allow-local` to the remote GitHub workflow.

## 9. Monitoring and alert verification

Confirm that operators can access authenticated metrics, structured logs, and tracing when configured. Trigger at least one safe test alert or equivalent delivery test to the real on-call route. Confirm request IDs can be followed from an external request into backend logs.

Record `monitoring_alerts` only after alert routing is proven.

## 10. Rollback

Rollback must be rehearsed before final launch approval.

Application rollback sequence:

1. stop new promotion/traffic changes;
2. identify the previous known-good Git/image revision;
3. determine whether the database migration is backward compatible with that revision;
4. if a database rollback is required, follow the reviewed Alembic downgrade path or restore the verified backup—never improvise destructive SQL;
5. deploy the previous application revision;
6. verify `/health/live` and `/health/ready`;
7. rerun the external smoke against the restored release;
8. verify order/payment/webhook queues for duplicates or stalled work;
9. communicate rollback completion and preserve incident evidence.

Record the rehearsal under `rollback_drill`. A waiver requires written operator notes and leaves Launch Readiness conditional rather than fully ready.

## 11. Release sign-off

Final go/no-go requires:

- no `block` result in `/admin/launch`;
- external Launch Smoke success for the target deployment;
- Paymob, Google, Apple, Twilio, and Odoo live acceptance gates passed when those product requirements are enabled;
- English and Arabic/RTL UAT passed;
- responsive/accessibility smoke passed;
- fulfillment/refund UAT passed;
- backup/restore drill passed;
- monitoring/alert verification passed;
- rollback drill passed;
- any warning/waiver reviewed explicitly by the release owner.

Record the release SHA and the final Launch Readiness state. Do not copy provider secrets, tokens, passwords, cookies, HMAC values, or customer-sensitive data into sign-off notes.

## 12. Post-launch observation

During the initial observation window, watch readiness, error rate, authentication/OTP failures, payment webhook failures, refund queue behavior, order fulfillment transitions, Odoo sync failures, worker backlog, and application latency. If a launch-critical condition degrades, use the Rollback procedure rather than applying unreviewed emergency mutations directly to production data.
