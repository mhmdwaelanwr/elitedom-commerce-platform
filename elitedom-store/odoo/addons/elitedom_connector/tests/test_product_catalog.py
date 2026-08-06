from odoo.tests.common import TransactionCase


class TestProductCatalogWebhook(TransactionCase):
    def setUp(self):
        super().setUp()
        self.env["ir.config_parameter"].sudo().set_param(
            "elitedom_connector.enabled",
            "true",
        )

    def test_published_sku_is_written_to_durable_outbox(self):
        template = self.env["product.template"].with_context(
            skip_elitedom_webhook=True
        ).create(
            {
                "name": "Elitedom Test GPU",
                "default_code": "GPU-ODOO-001",
                "list_price": 24999.0,
                "sale_ok": True,
                "elitedom_publish_to_store": True,
                "elitedom_brand": "Elitedom Labs",
                "elitedom_warranty_months": 24,
            }
        )
        product = template.product_variant_id

        product._enqueue_elitedom_catalog()

        event = self.env["elitedom.webhook.outbox"].search(
            [("event_type", "=", "product.catalog.updated")],
            order="id desc",
            limit=1,
        )
        self.assertTrue(event)
        self.assertEqual(event.endpoint_path, "/product")
        self.assertIn('"product_sku":"GPU-ODOO-001"', event.payload_json)
        self.assertIn('"active":true', event.payload_json)
