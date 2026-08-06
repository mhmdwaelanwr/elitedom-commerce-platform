from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    elitedom_connector_enabled = fields.Boolean(
        string="Enable Elitedom webhooks",
        config_parameter="elitedom_connector.enabled",
        help=(
            "Enqueue and deliver signed inventory and fulfillment webhooks. "
            "ELITEDOM_CONNECTOR_ENABLED overrides this value when set."
        ),
    )
    elitedom_connector_api_base_url = fields.Char(
        string="FastAPI webhook base URL",
        config_parameter="elitedom_connector.api_base_url",
        default="http://fastapi:8000/api/v1/webhooks/odoo",
        help=(
            "Base URL ending at /api/v1/webhooks/odoo. HTTPS is required except "
            "for the internal fastapi/localhost hosts."
        ),
    )
    elitedom_connector_webhook_secret = fields.Char(
        string="Webhook signing secret",
        config_parameter="elitedom_connector.webhook_secret",
        help=(
            "Shared HMAC secret. Use at least 32 random characters. "
            "ELITEDOM_WEBHOOK_SECRET overrides this value when set."
        ),
    )
    elitedom_connector_timeout_seconds = fields.Integer(
        string="HTTP timeout (seconds)",
        config_parameter="elitedom_connector.timeout_seconds",
        default=10,
    )
    elitedom_connector_max_attempts = fields.Integer(
        string="Maximum delivery attempts",
        config_parameter="elitedom_connector.max_attempts",
        default=8,
    )
    elitedom_connector_retention_days = fields.Integer(
        string="Delivered event retention (days)",
        config_parameter="elitedom_connector.retention_days",
        default=30,
    )
