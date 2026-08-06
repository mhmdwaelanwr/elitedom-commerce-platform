import hashlib
import hmac
import json

from odoo.tests.common import TransactionCase

from ..services.payloads import (
    canonical_json_bytes,
    inventory_payload,
    order_status_payload,
    product_catalog_payload,
    sign_body,
)


class TestWebhookPayloads(TransactionCase):
    def test_canonical_body_and_signature_are_deterministic(self):
        payload = inventory_payload(
            event_id="inventory-001",
            product_sku="GPU-001",
            new_quantity=7,
            timestamp="2026-08-06T01:00:00Z",
        )
        body = canonical_json_bytes(payload)
        self.assertEqual(json.loads(body), payload)
        self.assertEqual(
            sign_body("s" * 32, body),
            hmac.new(b"s" * 32, body, hashlib.sha256).hexdigest(),
        )

    def test_order_payload_omits_empty_optional_values(self):
        payload = order_status_payload(
            event_id="order-001",
            order_reference="ED-ORD-001",
            new_status="confirmed",
            timestamp="2026-08-06T01:00:00Z",
        )
        self.assertNotIn("tracking_number", payload)
        self.assertNotIn("carrier", payload)
        self.assertEqual(payload["new_status"], "confirmed")

    def test_product_payload_contains_storefront_master_data(self):
        payload = product_catalog_payload(
            event_id="product-001",
            product_sku="GPU-001",
            name="Elitedom GPU",
            list_price=25000,
            active=True,
            stock_qty=4,
            tracking="serial",
            category_name="Components / GPUs",
            category_slug="components-gpus",
            brand="Elitedom",
            warranty_months=24,
            timestamp="2026-08-06T01:00:00Z",
        )
        self.assertEqual(payload["category_slug"], "components-gpus")
        self.assertEqual(payload["stock_qty"], 4)
        self.assertTrue(payload["active"])
