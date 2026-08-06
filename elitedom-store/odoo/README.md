# Elitedom Odoo 17 Connector

The `elitedom_connector` addon is the Odoo-side half of the store integration.
It emits signed inventory and fulfillment webhooks through a durable Odoo
outbox. Business transactions never wait for FastAPI or the network.

## Events

| Odoo source | FastAPI endpoint | Event |
| --- | --- | --- |
| `stock.quant` quantity change | `/api/v1/webhooks/odoo/inventory` | authoritative SKU stock |
| `sale.order` state change | `/api/v1/webhooks/odoo/order-status` | confirmed/cancelled status |
| `stock.picking` done/cancel/tracking change | `/api/v1/webhooks/odoo/order-status` | shipment/tracking status |

Every request contains:

- `X-Elitedom-Signature`: HMAC-SHA256 of the exact JSON body.
- `X-Idempotency-Key`: the persistent Odoo outbox event UUID.
- A JSON `event_id` matching the idempotency header.

FastAPI stores a receipt before applying state, so a worker crash or webhook
retry cannot duplicate the mutation.

## Local installation

From `elitedom-store`:

```bash
cp .env.example .env
# Generate a shared secret and put the same value in ODOO_WEBHOOK_SECRET.
# Enable inbound delivery only after the secret is set:
# ODOO_WEBHOOKS_ENABLED=true
make dev
make odoo-install-connector

# For the full XML-RPC smoke test, first create a restricted Odoo API user,
# set ODOO_SYNC_ENABLED=true and provide ODOO_API_USER/ODOO_API_KEY.
make odoo-smoke
```

The addon directory is mounted read-only at `/mnt/extra-addons`. Installation
uses a one-shot Odoo process with `--no-http`, so it does not compete for the
running container's HTTP port.

## Configuration

The Docker service maps these `.env` values to the addon:

| `.env` variable | Purpose |
| --- | --- |
| `ODOO_WEBHOOKS_ENABLED` | Enables FastAPI verification and Odoo delivery |
| `ODOO_FASTAPI_WEBHOOK_URL` | Internal webhook base URL |
| `ODOO_WEBHOOK_SECRET` | Shared random HMAC secret, at least 32 characters |
| `ODOO_CONNECTOR_TIMEOUT_SECONDS` | Per-request timeout |
| `ODOO_CONNECTOR_MAX_ATTEMPTS` | Retry/dead-letter threshold |
| `ODOO_CONNECTOR_RETENTION_DAYS` | Retention for successfully delivered events |

Environment variables override values entered under **Settings → Elitedom
Store**. This keeps production secrets outside the Odoo database while still
allowing a convenient local UI.

## Failure behavior

- Network errors, HTTP 5xx, 408, 409, 425 and 429 are retried with exponential
  backoff.
- Other HTTP 4xx responses become dead letters because resending the same
  invalid contract is unsafe.
- A lease and `FOR UPDATE SKIP LOCKED` prevent concurrent cron workers from
  claiming the same event.
- Crashes after a remote success can cause a replay; the persistent event id
  makes that replay harmless.
- Response bodies are not stored, avoiding accidental PII retention.
- Dead letters are visible to system administrators under **Elitedom
  Connector → Webhook Outbox** and can be retried manually.

## Verification

```bash
python scripts/validate_odoo_addon.py
make test-e2e
```

CI additionally installs the addon into a clean Odoo 17 database and runs its
Odoo test suite.
