"""Odoo product-master hooks for the Elitedom storefront catalogue."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from odoo import api, fields, models

_CATALOG_FIELDS = {
    "name",
    "description_sale",
    "list_price",
    "active",
    "sale_ok",
    "categ_id",
    "tracking",
    "weight",
    "elitedom_publish_to_store",
    "elitedom_brand",
    "elitedom_image_urls",
    "elitedom_warranty_months",
    "elitedom_dropship_enabled",
}


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return normalized[:128] or "uncategorized"


class ProductTemplate(models.Model):
    _inherit = "product.template"

    elitedom_publish_to_store = fields.Boolean(
        string="Publish to Elitedom Store",
        help="Allow this product's variants to be created or updated in the storefront catalogue.",
    )
    elitedom_brand = fields.Char(string="Storefront Brand")
    elitedom_image_urls = fields.Text(
        string="Storefront Image URLs",
        help="Optional HTTPS image URLs, one per line. Locally uploaded storefront images take priority.",
    )
    elitedom_warranty_months = fields.Integer(string="Warranty (months)", default=12)
    elitedom_dropship_enabled = fields.Boolean(string="Dropship Enabled")

    @api.model_create_multi
    def create(self, values_list):
        records = super().create(values_list)
        if not self.env.context.get("skip_elitedom_webhook"):
            records.mapped("product_variant_ids")._enqueue_elitedom_catalog()
        return records

    def write(self, values):
        result = super().write(values)
        if not self.env.context.get("skip_elitedom_webhook") and _CATALOG_FIELDS.intersection(values):
            self.mapped("product_variant_ids")._enqueue_elitedom_catalog()
        return result

    def unlink(self):
        if not self.env.context.get("skip_elitedom_webhook"):
            self.mapped("product_variant_ids")._enqueue_elitedom_catalog(active_override=False)
        return super().unlink()


class ProductProduct(models.Model):
    _inherit = "product.product"

    @api.model_create_multi
    def create(self, values_list):
        records = super().create(values_list)
        if not self.env.context.get("skip_elitedom_webhook"):
            records._enqueue_elitedom_catalog()
        return records

    def write(self, values):
        result = super().write(values)
        if not self.env.context.get("skip_elitedom_webhook") and {
            "default_code",
            "active",
        }.intersection(values):
            self._enqueue_elitedom_catalog()
        return result

    def _enqueue_elitedom_catalog(self, active_override=None):
        outbox = self.env["elitedom.webhook.outbox"].sudo()
        for product in self:
            sku = (product.default_code or "").strip()
            if not sku:
                continue
            template = product.product_tmpl_id
            try:
                quantity = Decimal(str(product.qty_available))
            except (InvalidOperation, TypeError, ValueError):
                quantity = Decimal("0")
            stock_qty = max(0, int(quantity)) if quantity == quantity.to_integral_value() else 0
            image_urls = [
                line.strip()
                for line in (template.elitedom_image_urls or "").splitlines()
                if line.strip()
            ][:12]
            active = (
                bool(active_override)
                if active_override is not None
                else bool(
                    product.active
                    and template.active
                    and template.sale_ok
                    and template.elitedom_publish_to_store
                )
            )
            outbox.enqueue_product_catalog(
                product,
                active=active,
                stock_qty=stock_qty,
                image_urls=image_urls,
                category_slug=_slugify(template.categ_id.complete_name or template.categ_id.name),
            )
        return True
