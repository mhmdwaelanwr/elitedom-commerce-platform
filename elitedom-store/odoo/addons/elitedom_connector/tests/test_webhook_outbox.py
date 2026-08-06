import json
from unittest.mock import Mock, patch

from odoo.tests.common import TransactionCase


class TestWebhookOutbox(TransactionCase):
    def setUp(self):
        super().setUp()
        parameters = self.env["ir.config_parameter"].sudo()
        parameters.set_param("elitedom_connector.enabled", "true")
        parameters.set_param(
            "elitedom_connector.api_base_url",
            "http://fastapi:8000/api/v1/webhooks/odoo",
        )
        parameters.set_param("elitedom_connector.webhook_secret", "s" * 32)
        parameters.set_param("elitedom_connector.timeout_seconds", "5")
        parameters.set_param("elitedom_connector.max_attempts", "3")
        self.outbox = self.env["elitedom.webhook.outbox"]

    def _event(self):
        return self.outbox.enqueue(
            event_type="inventory.stock.updated",
            endpoint_path="/inventory",
            payload={
                "event_id": "odoo-test-inventory-001",
                "product_sku": "GPU-001",
                "new_quantity": 4,
                "timestamp": "2026-08-06T01:00:00Z",
            },
        )

    @patch.dict(
        "os.environ",
        {
            "ELITEDOM_CONNECTOR_ENABLED": "",
            "ELITEDOM_API_BASE_URL": "",
            "ELITEDOM_WEBHOOK_SECRET": "",
        },
        clear=False,
    )
    def test_dispatch_signs_and_marks_event_sent(self):
        event = self._event()
        response = Mock(status_code=200, text='{"status":"processed"}')

        with patch(
            "odoo.addons.elitedom_connector.models.webhook_outbox.requests.post",
            return_value=response,
        ) as request:
            result = self.outbox._cron_dispatch()

        event.invalidate_recordset()
        self.assertEqual(result, {"claimed": 1, "sent": 1, "pending": 0, "dead": 0})
        self.assertEqual(event.state, "sent")
        self.assertEqual(event.attempts, 1)
        self.assertEqual(event.response_code, 200)

        _, kwargs = request.call_args
        self.assertEqual(
            json.loads(kwargs["data"]),
            {
                "event_id": "odoo-test-inventory-001",
                "new_quantity": 4,
                "product_sku": "GPU-001",
                "timestamp": "2026-08-06T01:00:00Z",
            },
        )
        self.assertEqual(
            kwargs["headers"]["X-Idempotency-Key"],
            "odoo-test-inventory-001",
        )
        self.assertEqual(len(kwargs["headers"]["X-Elitedom-Signature"]), 64)
        self.assertEqual(kwargs["timeout"], 5)

    @patch.dict(
        "os.environ",
        {
            "ELITEDOM_CONNECTOR_ENABLED": "",
            "ELITEDOM_API_BASE_URL": "",
            "ELITEDOM_WEBHOOK_SECRET": "",
        },
        clear=False,
    )
    def test_server_failure_is_retried_without_fake_success(self):
        event = self._event()
        response = Mock(status_code=503, text="unavailable")

        with patch(
            "odoo.addons.elitedom_connector.models.webhook_outbox.requests.post",
            return_value=response,
        ):
            result = self.outbox._cron_dispatch()

        event.invalidate_recordset()
        self.assertEqual(result, {"claimed": 1, "sent": 0, "pending": 1, "dead": 0})
        self.assertEqual(event.state, "pending")
        self.assertEqual(event.attempts, 1)
        self.assertEqual(event.response_code, 503)
        self.assertFalse(event.delivered_at)
        self.assertGreater(event.available_at, event.create_date)

    @patch.dict(
        "os.environ",
        {
            "ELITEDOM_CONNECTOR_ENABLED": "",
            "ELITEDOM_API_BASE_URL": "",
            "ELITEDOM_WEBHOOK_SECRET": "",
        },
        clear=False,
    )
    def test_non_retryable_client_error_becomes_dead_letter(self):
        event = self._event()
        response = Mock(status_code=422, text="invalid payload")

        with patch(
            "odoo.addons.elitedom_connector.models.webhook_outbox.requests.post",
            return_value=response,
        ):
            result = self.outbox._cron_dispatch()

        event.invalidate_recordset()
        self.assertEqual(result, {"claimed": 1, "sent": 0, "pending": 0, "dead": 1})
        self.assertEqual(event.state, "dead")
        self.assertEqual(event.response_code, 422)
        self.assertNotIn("invalid payload", event.last_error)

    @patch.dict(
        "os.environ",
        {
            "ELITEDOM_CONNECTOR_ENABLED": "",
            "ELITEDOM_API_BASE_URL": "",
            "ELITEDOM_WEBHOOK_SECRET": "",
        },
        clear=False,
    )
    def test_disabled_connector_does_not_claim_or_send(self):
        self.env["ir.config_parameter"].sudo().set_param(
            "elitedom_connector.enabled", "false"
        )
        event = self._event()

        with patch(
            "odoo.addons.elitedom_connector.models.webhook_outbox.requests.post"
        ) as request:
            result = self.outbox._cron_dispatch()

        self.assertFalse(event)
        self.assertEqual(result["claimed"], 0)
        request.assert_not_called()
