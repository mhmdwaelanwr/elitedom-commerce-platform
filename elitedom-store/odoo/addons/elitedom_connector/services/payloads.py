"""Pure webhook payload helpers shared by Odoo and FastAPI contract tests."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any


def _timestamp(value: datetime | str | None = None) -> str:
    if value is None:
        value = datetime.now(timezone.utc)
    if isinstance(value, str):
        return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sign_body(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def inventory_payload(
    *,
    event_id: str,
    product_sku: str,
    new_quantity: int,
    warehouse_location: str | None = None,
    timestamp: datetime | str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event_id": event_id,
        "product_sku": product_sku,
        "new_quantity": int(new_quantity),
        "timestamp": _timestamp(timestamp),
    }
    if warehouse_location:
        payload["warehouse_location"] = warehouse_location
    return payload


def product_catalog_payload(
    *,
    event_id: str,
    product_sku: str,
    name: str,
    list_price: float,
    active: bool,
    stock_qty: int,
    tracking: str,
    description: str | None = None,
    category_name: str | None = None,
    category_slug: str | None = None,
    brand: str | None = None,
    warranty_months: int = 12,
    is_dropship_enabled: bool = False,
    weight_kg: float | None = None,
    image_urls: list[str] | None = None,
    odoo_product_id: int | None = None,
    timestamp: datetime | str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event_id": event_id,
        "product_sku": product_sku,
        "name": name,
        "list_price": float(list_price),
        "active": bool(active),
        "stock_qty": int(stock_qty),
        "tracking": tracking,
        "warranty_months": int(warranty_months),
        "is_dropship_enabled": bool(is_dropship_enabled),
        "timestamp": _timestamp(timestamp),
    }
    optional_values = {
        "description": description,
        "category_name": category_name,
        "category_slug": category_slug,
        "brand": brand,
        "weight_kg": weight_kg,
        "odoo_product_id": odoo_product_id,
    }
    payload.update({key: value for key, value in optional_values.items() if value not in (None, "")})
    if image_urls:
        payload["image_urls"] = image_urls
    return payload


def order_status_payload(
    *,
    event_id: str,
    order_reference: str,
    new_status: str,
    timestamp: datetime | str | None = None,
    tracking_number: str | None = None,
    carrier: str | None = None,
    picking_reference: str | None = None,
    odoo_order_id: int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event_id": event_id,
        "order_reference": order_reference,
        "new_status": new_status,
        "timestamp": _timestamp(timestamp),
    }
    optional_values = {
        "tracking_number": tracking_number,
        "carrier": carrier,
        "picking_reference": picking_reference,
        "odoo_order_id": odoo_order_id,
    }
    payload.update({key: value for key, value in optional_values.items() if value not in (None, "")})
    return payload
