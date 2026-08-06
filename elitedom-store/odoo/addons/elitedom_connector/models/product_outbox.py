"""Product-catalog event extension for the shared webhook outbox."""

from __future__ import annotations

from uuid import uuid4

from odoo import api, models

from ..services.payloads import product_catalog_payload


class ElitedomWebhookOutbox(models.Model):
    _inherit = "elitedom.webhook.outbox"

    @api.model
    def enqueue_product_catalog(
        self,
        product,
        *,
        active: bool,
        stock_qty: int,
        image_urls: list[str],
        category_slug: str,
    ):
        template = product.product_tmpl_id
        tracking = "serial" if template.tracking == "serial" else "barcode"
        payload = product_catalog_payload(
            event_id=str(uuid4()),
            product_sku=(product.default_code or "").strip(),
            name=product.display_name or template.name,
            description=template.description_sale or None,
            list_price=float(template.list_price),
            active=active,
            stock_qty=stock_qty,
            tracking=tracking,
            category_name=template.categ_id.complete_name or template.categ_id.name,
            category_slug=category_slug,
            brand=template.elitedom_brand or None,
            warranty_months=max(0, int(template.elitedom_warranty_months or 0)),
            is_dropship_enabled=bool(template.elitedom_dropship_enabled),
            weight_kg=float(template.weight) if template.weight else None,
            image_urls=image_urls,
            odoo_product_id=product.id,
            timestamp=product.write_date or product.create_date,
        )
        return self.enqueue(
            event_type="product.catalog.updated",
            endpoint_path="/product",
            payload=payload,
        )
