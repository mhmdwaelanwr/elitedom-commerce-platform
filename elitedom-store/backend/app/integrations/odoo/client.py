"""
Elitedom Store — Odoo ERP Client
XML-RPC/JSON-RPC client for bi-directional Odoo 17 synchronization.
Per ODOO.md Section 2.1.
"""

import logging
import xmlrpc.client
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class OdooClient:
    """
    Odoo 17 XML-RPC client.

    Authentication: Dedicated API user (elitedom_api_user) with restricted access.
    Protocol: XML-RPC over HTTPS.
    """

    def __init__(self):
        self.url = settings.odoo_url
        self.db = settings.odoo_db
        self.username = settings.odoo_api_user
        self.api_key = settings.odoo_api_key
        self._uid: int | None = None

    @property
    def is_configured(self) -> bool:
        """Whether the worker has usable Odoo connection credentials.

        The integration must fail closed instead of treating an empty or
        copied ``CHANGE_ME`` API key as a successful remote synchronization.
        """
        required_values = (self.url, self.db, self.username, self.api_key)
        return all(
            isinstance(value, str)
            and value.strip()
            and not value.strip().upper().startswith("CHANGE_ME")
            for value in required_values
        )

    @property
    def common(self) -> xmlrpc.client.ServerProxy:
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")

    @property
    def models(self) -> xmlrpc.client.ServerProxy:
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def authenticate(self) -> int:
        """Authenticate with Odoo and cache the UID."""
        if not self.is_configured:
            raise RuntimeError("Odoo integration credentials are not configured")

        if self._uid is None:
            self._uid = self.common.authenticate(self.db, self.username, self.api_key, {})
            if not self._uid:
                raise ConnectionError("Failed to authenticate with Odoo ERP")
            logger.info(f"Authenticated with Odoo as UID: {self._uid}")
        return self._uid

    def execute(
        self,
        model: str,
        method: str,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Execute an Odoo XML-RPC method on a model."""
        uid = self.authenticate()
        return self.models.execute_kw(self.db, uid, self.api_key, model, method, list(args), kwargs)

    # ── Product Sync (Odoo → FastAPI) ────────────────────────────────

    def get_products(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """Fetch products from Odoo product.template model."""
        return self.execute(
            "product.template",
            "search_read",
            [("active", "=", True)],
            fields=[
                "name",
                "default_code",
                "list_price",
                "qty_available",
                "categ_id",
                "tracking",
                "active",
            ],
            limit=limit,
            offset=offset,
        )

    # ── Order Sync (FastAPI → Odoo) ──────────────────────────────────

    def create_sale_order(self, order_data: dict) -> int:
        """Create a Sales Order in Odoo."""
        return self.execute("sale.order", "create", [order_data])

    def confirm_sale_order(self, odoo_order_id: int) -> bool:
        """Confirm a draft sales order in Odoo."""
        return self.execute("sale.order", "action_confirm", [[odoo_order_id]])

    def find_sale_order_by_reference(self, order_reference: str) -> dict | None:
        """Find an Odoo sale order created for an Elitedom order reference."""
        orders = self.execute(
            "sale.order",
            "search_read",
            [("client_order_ref", "=", order_reference)],
            fields=["id", "state"],
            limit=1,
        )
        return orders[0] if orders else None

    def find_product_by_sku(self, sku: str) -> int | None:
        """Return the Odoo product variant id for an Elitedom SKU, if present."""
        products = self.execute(
            "product.product",
            "search_read",
            [("default_code", "=", sku)],
            fields=["id"],
            limit=1,
        )
        return int(products[0]["id"]) if products else None

    # ── Customer Sync (Bidirectional) ────────────────────────────────

    def find_or_create_partner(self, email: str, name: str, phone: str) -> int:
        """Find existing partner by email or create new one."""
        partners = self.execute(
            "res.partner",
            "search_read",
            [("email", "=", email)],
            fields=["id"],
            limit=1,
        )
        if partners:
            return partners[0]["id"]

        return self.execute(
            "res.partner",
            "create",
            [{"name": name, "email": email, "phone": phone}],
        )

    # ── Inventory Sync (Odoo → FastAPI) ──────────────────────────────

    def get_stock_levels(self, product_ids: list[int]) -> list[dict]:
        """Get current stock quantities from Odoo."""
        return self.execute(
            "product.product",
            "search_read",
            [("id", "in", product_ids)],
            fields=["id", "default_code", "qty_available", "virtual_available"],
        )

    # ── Currency Sync (Odoo → FastAPI) ────────────────────────────────

    def get_currencies(self) -> list[dict]:
        """Fetch active currency master data from Odoo."""
        return self.execute(
            "res.currency",
            "search_read",
            [("active", "=", True)],
            fields=["id", "name", "symbol"],
            limit=1000,
        )

    def get_currency_rates(self, currency_ids: list[int]) -> list[dict]:
        """Fetch current rate ledger rows for the supplied Odoo currencies."""
        domain: list[tuple[str, str, list[int]]] = []
        if currency_ids:
            domain = [("currency_id", "in", currency_ids)]
        return self.execute(
            "res.currency.rate",
            "search_read",
            domain,
            fields=["currency_id", "name", "rate"],
            order="name desc",
            limit=5000,
        )


# Singleton client instance
odoo_client = OdooClient()
