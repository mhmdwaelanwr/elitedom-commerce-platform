"""Odoo product-master webhook contract coverage."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.webhook_signature import settings as webhook_settings
from app.models import ProductCategory, ProductImage, ProductTemplate


def _load_payloads() -> ModuleType:
    path = (
        Path(__file__).resolve().parents[4]
        / "odoo"
        / "addons"
        / "elitedom_connector"
        / "services"
        / "payloads.py"
    )
    spec = importlib.util.spec_from_file_location("elitedom_product_payloads", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import payload helpers from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


payloads = _load_payloads()


@pytest.mark.asyncio
async def test_product_webhook_creates_updates_and_deduplicates(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    payload = payloads.product_catalog_payload(
        event_id="product-master-001",
        product_sku="ODOO-GPU-001",
        name="Odoo Managed GPU",
        description="Created from the Odoo product master.",
        list_price=35999,
        active=True,
        stock_qty=8,
        tracking="serial",
        category_name="Components / GPUs",
        category_slug="components-gpus",
        brand="Elitedom Labs",
        warranty_months=24,
        image_urls=["https://cdn.example.test/gpu.webp"],
        odoo_product_id=501,
        timestamp="2026-08-06T03:00:00Z",
    )
    body = payloads.canonical_json_bytes(payload)
    headers = {
        "X-Elitedom-Signature": payloads.sign_body(
            webhook_settings.odoo_webhook_secret,
            body,
        ),
        "X-Idempotency-Key": payload["event_id"],
    }

    created = await client.post("/api/v1/webhooks/odoo/product", content=body, headers=headers)
    duplicate = await client.post("/api/v1/webhooks/odoo/product", content=body, headers=headers)

    assert created.status_code == 200
    assert created.json()["created"] is True
    assert duplicate.status_code == 200
    assert duplicate.json()["status"] == "duplicate"

    product = await db_session.scalar(
        select(ProductTemplate).where(ProductTemplate.sku == "ODOO-GPU-001")
    )
    assert product is not None
    category = await db_session.get(ProductCategory, product.category_id)
    image = await db_session.scalar(
        select(ProductImage).where(ProductImage.product_id == product.id)
    )
    assert category is not None and category.slug == "components-gpus"
    assert image is not None and image.is_primary is True

    update_payload = payloads.product_catalog_payload(
        event_id="product-master-002",
        product_sku="ODOO-GPU-001",
        name="Odoo Managed GPU v2",
        list_price=36999,
        active=False,
        stock_qty=0,
        tracking="serial",
        category_name="Components / GPUs",
        category_slug="components-gpus",
        brand="Elitedom Labs",
        warranty_months=36,
        image_urls=["https://cdn.example.test/replacement.webp"],
        timestamp="2026-08-06T03:05:00Z",
    )
    update_body = payloads.canonical_json_bytes(update_payload)
    updated = await client.post(
        "/api/v1/webhooks/odoo/product",
        content=update_body,
        headers={
            "X-Elitedom-Signature": payloads.sign_body(
                webhook_settings.odoo_webhook_secret,
                update_body,
            ),
            "X-Idempotency-Key": update_payload["event_id"],
        },
    )
    assert updated.status_code == 200
    await db_session.refresh(product)
    assert product.name == "Odoo Managed GPU v2"
    assert product.is_active is False
    assert product.warranty_months == 36
    images = list(
        (
            await db_session.scalars(
                select(ProductImage).where(ProductImage.product_id == product.id)
            )
        ).all()
    )
    assert [item.url for item in images] == ["https://cdn.example.test/gpu.webp"]
