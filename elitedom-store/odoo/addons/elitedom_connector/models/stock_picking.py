from odoo import models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    def write(self, values):
        previous = {
            picking.id: (
                picking.state,
                getattr(picking, "carrier_tracking_ref", False),
                getattr(picking, "carrier_id", False).id
                if getattr(picking, "carrier_id", False)
                else False,
            )
            for picking in self
        }
        result = super().write(values)
        if self.env.context.get("skip_elitedom_webhook"):
            return result

        relevant_fields = {"state", "carrier_tracking_ref", "carrier_id"}
        if not relevant_fields.intersection(values):
            return result

        outbox = self.env["elitedom.webhook.outbox"].sudo()
        for picking in self:
            order = picking.sale_id
            if not order or not order.client_order_ref:
                continue

            previous_state, previous_tracking, previous_carrier = previous[picking.id]
            tracking = getattr(picking, "carrier_tracking_ref", False)
            carrier = (
                getattr(picking, "carrier_id", False).id
                if getattr(picking, "carrier_id", False)
                else False
            )
            changed_tracking = (
                previous_tracking != tracking or previous_carrier != carrier
            )

            if picking.state == "done" and (
                previous_state != "done" or changed_tracking
            ):
                outbox.enqueue_order_status(order, "shipped", picking=picking)
            elif picking.state == "cancel" and previous_state != "cancel":
                outbox.enqueue_order_status(order, "cancelled", picking=picking)
        return result
