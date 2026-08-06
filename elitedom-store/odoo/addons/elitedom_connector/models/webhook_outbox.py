"""Durable, signed webhook delivery for the Elitedom FastAPI boundary."""

from __future__ import annotations

import logging
import os
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit
from uuid import uuid4

import requests

from odoo import api, fields, models

from ..services.payloads import (
    canonical_json_bytes,
    inventory_payload,
    order_status_payload,
    sign_body,
)

_logger = logging.getLogger(__name__)

_PLACEHOLDER_MARKERS = (
    "change_me",
    "changeme",
    "placeholder",
    "replace_me",
    "replace-with",
    "example",
    "dummy",
)
_RETRYABLE_HTTP_STATUSES = {408, 409, 425, 429}
_ALLOWED_INTERNAL_HTTP_HOSTS = {"fastapi", "localhost", "127.0.0.1", "::1"}


def _as_bool(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _bounded_int(value: object, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(parsed, maximum))


def _secure_secret(value: object) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip()
    lowered = normalized.lower()
    return len(normalized) >= 32 and not any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


def _safe_base_url(value: str) -> bool:
    parsed = urlsplit(value.strip())
    if not parsed.netloc or parsed.username is not None or parsed.password is not None:
        return False
    if parsed.scheme == "https":
        return True
    return parsed.scheme == "http" and (parsed.hostname or "") in _ALLOWED_INTERNAL_HTTP_HOSTS


class ElitedomWebhookOutbox(models.Model):
    _name = "elitedom.webhook.outbox"
    _description = "Elitedom Webhook Outbox"
    _order = "available_at, id"

    event_id = fields.Char(required=True, readonly=True, index=True)
    event_type = fields.Char(required=True, readonly=True, index=True)
    endpoint_path = fields.Char(required=True, readonly=True)
    payload_json = fields.Text(required=True, readonly=True)
    state = fields.Selection(
        [
            ("pending", "Pending"),
            ("processing", "Processing"),
            ("sent", "Sent"),
            ("dead", "Dead Letter"),
        ],
        required=True,
        default="pending",
        index=True,
        readonly=True,
    )
    attempts = fields.Integer(default=0, readonly=True)
    available_at = fields.Datetime(default=fields.Datetime.now, required=True, index=True)
    locked_until = fields.Datetime(index=True, readonly=True)
    delivered_at = fields.Datetime(readonly=True)
    response_code = fields.Integer(readonly=True)
    last_error = fields.Text(readonly=True)

    _sql_constraints = [
        (
            "elitedom_webhook_outbox_event_id_unique",
            "unique(event_id)",
            "The webhook event id must be unique.",
        )
    ]

    @api.model
    def _setting(self, env_name: str, parameter_name: str, default: str = "") -> str:
        """Read immutable deployment env first, then the Odoo system parameter."""
        environment_value = os.getenv(env_name)
        if environment_value not in (None, ""):
            return environment_value
        return (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param(parameter_name, default=default)
        )

    @api.model
    def _connector_config(self) -> dict[str, object]:
        return {
            "enabled": _as_bool(
                self._setting(
                    "ELITEDOM_CONNECTOR_ENABLED",
                    "elitedom_connector.enabled",
                    "false",
                )
            ),
            "api_base_url": self._setting(
                "ELITEDOM_API_BASE_URL",
                "elitedom_connector.api_base_url",
                "http://fastapi:8000/api/v1/webhooks/odoo",
            ).rstrip("/"),
            "webhook_secret": self._setting(
                "ELITEDOM_WEBHOOK_SECRET",
                "elitedom_connector.webhook_secret",
                "",
            ),
            "timeout_seconds": _bounded_int(
                self._setting(
                    "ELITEDOM_CONNECTOR_TIMEOUT_SECONDS",
                    "elitedom_connector.timeout_seconds",
                    "10",
                ),
                default=10,
                minimum=1,
                maximum=60,
            ),
            "max_attempts": _bounded_int(
                self._setting(
                    "ELITEDOM_CONNECTOR_MAX_ATTEMPTS",
                    "elitedom_connector.max_attempts",
                    "8",
                ),
                default=8,
                minimum=1,
                maximum=20,
            ),
            "retention_days": _bounded_int(
                self._setting(
                    "ELITEDOM_CONNECTOR_RETENTION_DAYS",
                    "elitedom_connector.retention_days",
                    "30",
                ),
                default=30,
                minimum=1,
                maximum=365,
            ),
        }

    @api.model
    def _validated_config(self) -> dict[str, object] | None:
        config = self._connector_config()
        if not config["enabled"]:
            return None
        if not _safe_base_url(str(config["api_base_url"])):
            _logger.error(
                "Elitedom connector is enabled but its API base URL is unsafe or invalid."
            )
            return None
        if not _secure_secret(config["webhook_secret"]):
            _logger.error(
                "Elitedom connector is enabled but its webhook secret is missing or insecure."
            )
            return None
        return config

    @api.model
    def enqueue(
        self,
        *,
        event_type: str,
        endpoint_path: str,
        payload: dict[str, object],
    ):
        """Persist a webhook before any external I/O is attempted."""
        if not self._connector_config()["enabled"]:
            _logger.debug(
                "Skipping %s because the Elitedom connector is disabled.",
                event_type,
            )
            return self.browse()

        event_id = str(payload.get("event_id") or uuid4())
        payload = dict(payload)
        payload["event_id"] = event_id
        body = canonical_json_bytes(payload).decode("utf-8")
        return self.sudo().create(
            {
                "event_id": event_id,
                "event_type": event_type,
                "endpoint_path": endpoint_path,
                "payload_json": body,
            }
        )

    @api.model
    def enqueue_inventory(self, product, warehouse_location: str | None = None):
        sku = (product.default_code or "").strip()
        if not sku:
            _logger.info(
                "Skipping Elitedom inventory webhook for Odoo product %s without a SKU.",
                product.id,
            )
            return self.browse()

        try:
            quantity = Decimal(str(product.qty_available))
        except (InvalidOperation, TypeError, ValueError):
            _logger.warning(
                "Skipping Elitedom inventory webhook for SKU %s with invalid quantity %r.",
                sku,
                product.qty_available,
            )
            return self.browse()

        if quantity < 0 or quantity != quantity.to_integral_value():
            _logger.warning(
                "Skipping Elitedom inventory webhook for SKU %s: FastAPI stock requires "
                "a non-negative whole quantity, received %s.",
                sku,
                quantity,
            )
            return self.browse()

        payload = inventory_payload(
            event_id=str(uuid4()),
            product_sku=sku,
            new_quantity=int(quantity),
            warehouse_location=warehouse_location,
        )
        return self.enqueue(
            event_type="inventory.stock.updated",
            endpoint_path="/inventory",
            payload=payload,
        )

    @api.model
    def enqueue_order_status(self, order, status: str, picking=None):
        reference = (order.client_order_ref or "").strip()
        if not reference:
            _logger.debug(
                "Skipping Elitedom order webhook for Odoo sale order %s without "
                "client_order_ref.",
                order.id,
            )
            return self.browse()

        tracking_number = None
        carrier = None
        picking_reference = None
        if picking:
            tracking_number = getattr(picking, "carrier_tracking_ref", None)
            carrier_record = getattr(picking, "carrier_id", None)
            carrier = carrier_record.display_name if carrier_record else None
            picking_reference = picking.name

        payload = order_status_payload(
            event_id=str(uuid4()),
            order_reference=reference,
            new_status=status,
            tracking_number=tracking_number,
            carrier=carrier,
            picking_reference=picking_reference,
            odoo_order_id=order.id,
        )
        return self.enqueue(
            event_type="sale.order.status.updated",
            endpoint_path="/order-status",
            payload=payload,
        )

    @api.model
    def _claim_batch(self, limit: int = 50):
        """Atomically lease due events across concurrent cron workers."""
        now = fields.Datetime.now()
        lock_until = now + timedelta(minutes=5)
        self.env.cr.execute(
            """
            UPDATE elitedom_webhook_outbox
               SET state = 'processing',
                   attempts = attempts + 1,
                   locked_until = %s
             WHERE id IN (
                   SELECT id
                     FROM elitedom_webhook_outbox
                    WHERE (
                          state = 'pending'
                          AND available_at <= %s
                    ) OR (
                          state = 'processing'
                          AND locked_until IS NOT NULL
                          AND locked_until <= %s
                    )
                    ORDER BY available_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT %s
             )
             RETURNING id
            """,
            [lock_until, now, now, max(1, min(int(limit), 200))],
        )
        ids = [row[0] for row in self.env.cr.fetchall()]
        records = self.browse(ids)
        records.invalidate_recordset(["state", "attempts", "locked_until"])
        return records

    def _request_url(self, base_url: str) -> str:
        self.ensure_one()
        return f"{base_url.rstrip('/')}/{self.endpoint_path.lstrip('/')}"

    def _mark_sent(self, status_code: int) -> None:
        self.ensure_one()
        self.write(
            {
                "state": "sent",
                "response_code": status_code,
                "delivered_at": fields.Datetime.now(),
                "locked_until": False,
                "last_error": False,
            }
        )

    def _mark_failure(
        self,
        *,
        reason: str,
        status_code: int | None,
        retryable: bool,
        max_attempts: int,
    ) -> None:
        self.ensure_one()
        terminal = not retryable or self.attempts >= max_attempts
        values: dict[str, object] = {
            "state": "dead" if terminal else "pending",
            "response_code": status_code or 0,
            "last_error": reason[:1000],
            "locked_until": False,
        }
        if not terminal:
            delay_seconds = min(3600, 30 * (3 ** max(self.attempts - 1, 0)))
            values["available_at"] = fields.Datetime.now() + timedelta(
                seconds=delay_seconds
            )
        self.write(values)

    def _dispatch_one(self, config: dict[str, object]) -> None:
        self.ensure_one()
        body = self.payload_json.encode("utf-8")
        signature = sign_body(str(config["webhook_secret"]), body)
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "elitedom-odoo-connector/17.0",
            "X-Elitedom-Signature": signature,
            "X-Idempotency-Key": self.event_id,
        }

        try:
            response = requests.post(
                self._request_url(str(config["api_base_url"])),
                data=body,
                headers=headers,
                timeout=int(config["timeout_seconds"]),
            )
        except requests.RequestException as error:
            self._mark_failure(
                reason=f"{error.__class__.__name__}: {error}",
                status_code=None,
                retryable=True,
                max_attempts=int(config["max_attempts"]),
            )
            return

        if 200 <= response.status_code < 300:
            self._mark_sent(response.status_code)
            return

        retryable = (
            response.status_code >= 500
            or response.status_code in _RETRYABLE_HTTP_STATUSES
        )
        self._mark_failure(
            reason=f"FastAPI returned HTTP {response.status_code}.",
            status_code=response.status_code,
            retryable=retryable,
            max_attempts=int(config["max_attempts"]),
        )

    @api.model
    def _cron_dispatch(self, limit: int = 50) -> dict[str, int]:
        config = self._validated_config()
        if config is None:
            return {"claimed": 0, "sent": 0, "pending": 0, "dead": 0}

        records = self._claim_batch(limit=limit)
        result = {"claimed": len(records), "sent": 0, "pending": 0, "dead": 0}
        for record in records:
            record._dispatch_one(config)
            result[record.state] += 1
        return result

    @api.model
    def _cron_purge(self) -> int:
        config = self._connector_config()
        cutoff = fields.Datetime.now() - timedelta(days=int(config["retention_days"]))
        records = self.search(
            [
                ("state", "=", "sent"),
                ("delivered_at", "!=", False),
                ("delivered_at", "<", cutoff),
            ],
            limit=5000,
        )
        count = len(records)
        records.unlink()
        return count

    def action_retry(self):
        self.filtered(lambda record: record.state == "dead").write(
            {
                "state": "pending",
                "available_at": fields.Datetime.now(),
                "locked_until": False,
                "last_error": False,
                "attempts": 0,
            }
        )
        return True

    def action_dispatch_now(self):
        config = self._validated_config()
        if config is None:
            return False
        for record in self.filtered(lambda item: item.state in {"pending", "dead"}):
            record.write(
                {
                    "state": "processing",
                    "attempts": record.attempts + 1,
                    "locked_until": fields.Datetime.now() + timedelta(minutes=5),
                }
            )
            record._dispatch_one(config)
        return True
