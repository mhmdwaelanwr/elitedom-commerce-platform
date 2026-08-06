from odoo import models


_STATUS_BY_STATE = {
    "draft": "draft",
    "sent": "sent",
    "sale": "confirmed",
    "done": "delivered",
    "cancel": "cancelled",
}


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def write(self, values):
        previous_states = {order.id: order.state for order in self}
        result = super().write(values)
        if (
            "state" not in values
            or self.env.context.get("skip_elitedom_webhook")
        ):
            return result

        outbox = self.env["elitedom.webhook.outbox"].sudo()
        for order in self:
            if previous_states.get(order.id) == order.state:
                continue
            status = _STATUS_BY_STATE.get(order.state)
            if status:
                outbox.enqueue_order_status(order, status)
        return result
