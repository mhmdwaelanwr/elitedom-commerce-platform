"""Signed Odoo product-master webhook handler."""

from __future__ import annotations

from decimal import Decimal
from urllib.parse import urlsplit

from fastapi import APIRouter
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .webhooks import (
    DatabaseSession,
    IdempotencyKey,
    VerifiedOdooBody,
    _OdooWebhookPayload,
    _claim_delivery,
    _event_key,
    _parse_payload,
)
from app.models import ProductCategory, ProductImage, ProductTemplate
from app.shared.events import ProductCreated, ProductUpdated
from app.shared.outbox import publish_domain_event

router = APIRouter()


class ProductCatalogWebhookPayload(_OdooWebhookPayload):
    product_sku: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    list_price: Decimal = Field(..., ge=0)
    active: bool
    stock_qty: int = Field(..., ge=0)
    tracking: str = Field(default="barcode", pattern="^(serial|barcode)$")
    category_name: str | None = Field(default=None, max_length=255)
    category_slug: str | None = Field(
        default=None,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        max_length=128,
    )
    brand: str | None = Field(default=None, max_length=128)
    warranty_months: int = Field(default=12, ge=0, le=120)
    is_dropship_enabled: bool = False
    weight_kg: Decimal | None = Field(default=None, ge=0)
    image_urls: list[str] = Field(default_factory=list, max_length=12)
    odoo_product_id: int | None = Field(default=None, ge=1)

    @field_validator("product_sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.upper()

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, values: list[str]) -> list[str]:
        accepted: list[str] = []
        for raw in values:
            value = raw.strip()
            if value.startswith(("/media/", "/template/")):
                accepted.append(value)
                continue
            parsed = urlsplit(value)
            if (
                parsed.scheme == "https"
                and parsed.netloc
                and parsed.username is None
                and parsed.password is None
            ):
                accepted.append(value)
                continue
            raise ValueError("image_urls must contain HTTPS or managed local media URLs.")
        return accepted


async def _category_for_payload(
    db: AsyncSession,
    payload: ProductCatalogWebhookPayload,
) -> ProductCategory | None:
    if not payload.category_slug:
        return None
    category = await db.scalar(
        select(ProductCategory).where(ProductCategory.slug == payload.category_slug)
    )
    if category is None:
        category = ProductCategory(
            slug=payload.category_slug,
            name=payload.category_name or payload.category_slug.replace("-", " ").title(),
            description="Synchronized from Odoo product categories.",
            is_active=True,
        )
        db.add(category)
        await db.flush()
    elif payload.category_name and category.name != payload.category_name:
        category.name = payload.category_name
    return category


@router.post("/product")
async def odoo_product_catalog_webhook(
    body: VerifiedOdooBody,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
):
    """Upsert Odoo master data while preserving the curated local gallery."""
    payload = _parse_payload(body, ProductCatalogWebhookPayload)
    event_key = _event_key(body, payload.event_id, idempotency_key)
    if not await _claim_delivery(
        db,
        body=body,
        event_key=event_key,
        event_type="product.catalog.updated",
    ):
        return {"status": "duplicate", "event_key": event_key, "sku": payload.product_sku}

    category = await _category_for_payload(db, payload)
    product = await db.scalar(
        select(ProductTemplate)
        .options(selectinload(ProductTemplate.images))
        .where(ProductTemplate.sku == payload.product_sku)
        .with_for_update()
    )
    created = product is None
    if product is None:
        product = ProductTemplate(
            name=payload.name,
            sku=payload.product_sku,
            description=payload.description,
            tracking=payload.tracking,
            base_cost_usd=Decimal("0.00"),
            target_margin_percent=Decimal("0.00"),
            list_price=payload.list_price,
            category_id=category.id if category else None,
            brand=payload.brand,
            is_dropship_enabled=payload.is_dropship_enabled,
            is_active=payload.active,
            stock_qty=payload.stock_qty,
            weight_kg=payload.weight_kg,
            warranty_months=payload.warranty_months,
        )
        db.add(product)
        await db.flush()
    else:
        product.name = payload.name
        product.description = payload.description
        product.tracking = payload.tracking
        product.list_price = payload.list_price
        product.category_id = category.id if category else None
        product.brand = payload.brand
        product.is_dropship_enabled = payload.is_dropship_enabled
        product.is_active = payload.active
        product.stock_qty = payload.stock_qty
        product.weight_kg = payload.weight_kg
        product.warranty_months = payload.warranty_months

    if created and payload.image_urls:
        for index, url in enumerate(payload.image_urls):
            db.add(
                ProductImage(
                    product_id=product.id,
                    url=url,
                    alt_text=product.name,
                    sort_order=index,
                    is_primary=index == 0,
                )
            )

    await db.flush()
    event_type = ProductCreated if created else ProductUpdated
    await publish_domain_event(
        db,
        event_type(
            payload={
                "product_id": product.id,
                "sku": product.sku,
                "source": "odoo_webhook",
                "event_key": event_key,
                "occurred_at": payload.timestamp.isoformat(),
            }
        ),
        source_context="odoo_webhook",
    )
    return {
        "status": "processed",
        "event_key": event_key,
        "sku": product.sku,
        "product_id": product.id,
        "created": created,
        "active": product.is_active,
        "stock_qty": product.stock_qty,
    }
