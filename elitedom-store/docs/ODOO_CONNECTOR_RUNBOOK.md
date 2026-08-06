# Odoo Connector Operations Runbook

## Readiness checklist

1. `ODOO_WEBHOOK_SECRET` is a generated value of at least 32 characters.
2. `ODOO_WEBHOOKS_ENABLED=true` is set only after the same secret is available
   to FastAPI and Odoo.
3. `ODOO_SYNC_ENABLED=true` is set only after the dedicated Odoo API user and
   API key are provisioned.
4. The addon is installed with `make odoo-install-connector`.
5. `make odoo-smoke` reports the Odoo server version and addon state.
6. The Odoo Webhook Outbox has no growing dead-letter backlog.
7. The FastAPI logs show signed webhook receipts without signature failures.

## Deployment sequence

```bash
make prod-config
make prod-up
make prod-odoo-upgrade
make prod-migrate
make prod-odoo-smoke
```

Run the addon upgrade before enabling webhooks when a release changes its
models, views or scheduled actions.

## Smoke test

```bash
make odoo-smoke
```

The command fails non-zero when:

- outbound XML-RPC sync is disabled or missing credentials;
- authentication fails;
- `elitedom_connector` is absent or not installed.

For inbound webhooks, create or adjust a stock quantity in Odoo and confirm:

1. A pending event appears in **Elitedom Connector → Webhook Outbox**.
2. It transitions to **Sent**.
3. The matching FastAPI product stock changes.
4. Re-dispatching the same event returns a duplicate receipt without a second
   state mutation.

## Dead-letter triage

1. Open the event and note the HTTP status.
2. `401`: secrets differ between Odoo and FastAPI.
3. `404`: the SKU/order reference does not exist in FastAPI.
4. `422`: payload contract mismatch; do not blindly retry.
5. `429` or `5xx`: the connector automatically retries.
6. Fix the root cause, select **Retry dead letter**, then **Dispatch now**.

Do not copy payloads into public tickets; order references and tracking numbers
are operational data.

## Recovery and replay

The outbox is the recovery record. Restoring the Odoo database restores pending
events too. Events already delivered may be replayed after a point-in-time
restore, but FastAPI's receipt table makes the replay idempotent.

## Disable procedure

Set `ODOO_WEBHOOKS_ENABLED=false` and restart Odoo/FastAPI. Existing pending
or dead-letter events remain available for inspection, but the addon stops
creating and dispatching new events while disabled. Re-enable only after the
shared secret and FastAPI endpoint are ready. Uninstall the addon only after
the outbox is empty and the integration is intentionally retired.
