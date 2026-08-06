from odoo import api, models


class StockQuant(models.Model):
    _inherit = "stock.quant"

    @api.model_create_multi
    def create(self, values_list):
        records = super().create(values_list)
        if not self.env.context.get("skip_elitedom_webhook"):
            records._enqueue_elitedom_inventory()
        return records

    def write(self, values):
        result = super().write(values)
        if (
            "quantity" in values
            and not self.env.context.get("skip_elitedom_webhook")
        ):
            self._enqueue_elitedom_inventory()
        return result

    def _enqueue_elitedom_inventory(self):
        outbox = self.env["elitedom.webhook.outbox"].sudo()
        for product in self.mapped("product_id").filtered("default_code"):
            locations = self.filtered(
                lambda quant: quant.product_id == product
            ).mapped("location_id.complete_name")
            warehouse_location = locations[0] if len(locations) == 1 else None
            outbox.enqueue_inventory(product, warehouse_location=warehouse_location)
