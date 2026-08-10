"""Bootstrap a launch-ready staging catalogue.

This script creates a minimal but genuinely launch-ready product catalogue
for staging environments. It is gated behind ALLOW_STAGING_FIXTURES=true
and will not run in production.

The product created meets all launch gate requirements:
- is_active=True, publication_status="published"
- name, sku, slug, positive list_price
- Active category with slug/name
- Real media under /media/... (exactly one primary image)
- stock_qty > 0

This script is idempotent — it skips creation if the product already exists.
"""

from __future__ import annotations

import asyncio
import base64
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory, engine
from app.models import ProductCategory, ProductImage, ProductSupplier, ProductTemplate, Supplier
from app.modules.products.catalog_models import (
    CategoryCatalogContent,
    ProductCatalogContent,
)

# Minimal 1x1 white PNG (67 bytes) — real image that passes validation
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
    "nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg=="
)
_TINY_PNG_BYTES = base64.b64decode(_TINY_PNG_B64)

STAGING_SKU = "STG-BOOTSTRAP-001"
STAGING_CATEGORY_SLUG = "staging-bootstrap"
STAGING_PRODUCT_SLUG = "staging-bootstrap-product"


async def _get_or_create_supplier(session: Any) -> Supplier:
    """Create or retrieve the staging bootstrap supplier."""
    supplier = await session.scalar(
        select(Supplier).where(Supplier.email == "staging-bootstrap@elitedom.local")
    )
    if supplier is None:
        supplier = Supplier(
            name="Staging Bootstrap Supplier",
            contact_name="Automated staging bootstrap",
            email="staging-bootstrap@elitedom.local",
            lead_time_days=1,
            is_active=True,
            is_verified=True,
        )
        session.add(supplier)
        await session.flush()
    else:
        supplier.is_active = True
        supplier.is_verified = True
    return supplier


async def _get_or_create_category(session: Any) -> ProductCategory:
    """Create or retrieve the staging bootstrap category."""
    existing = await session.scalar(
        select(ProductCategory).where(ProductCategory.slug == STAGING_CATEGORY_SLUG)
    )
    if existing is not None:
        return existing

    category = ProductCategory(
        slug=STAGING_CATEGORY_SLUG,
        name="Staging Bootstrap",
        description="Auto-generated category for staging launch gate testing.",
        sort_order=999,
        is_active=True,
    )
    session.add(category)
    await session.flush()

    # Create catalog content for the category
    session.add(
        CategoryCatalogContent(
            category_id=category.id,
            name_ar="اختبار المرحلة",
            is_featured=False,
        )
    )
    return category


def _write_tiny_png(media_root: Path, product_id: int) -> str:
    """Write a minimal valid PNG to media_root and return its public URL path."""
    image_dir = media_root / "products" / str(product_id)
    image_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.png"
    image_path = image_dir / filename
    image_path.write_bytes(_TINY_PNG_BYTES)

    return f"/media/products/{product_id}/{filename}"


async def bootstrap_staging_catalog() -> dict[str, Any]:
    """Create a launch-ready product for staging. Returns summary dict."""
    settings = get_settings()

    if not settings.allow_staging_fixtures:
        raise RuntimeError(
            "ALLOW_STAGING_FIXTURES must be true to run staging bootstrap. "
            "This script will not run in production."
        )

    if settings.environment == "production":
        raise RuntimeError("Staging bootstrap must not run in production.")

    summary: dict[str, Any] = {
        "category_created": False,
        "product_created": False,
        "image_created": False,
        "sku": STAGING_SKU,
        "slug": STAGING_PRODUCT_SLUG,
    }

    async with async_session_factory() as session:
        supplier = await _get_or_create_supplier(session)
        category = await _get_or_create_category(session)

        # Check if product already exists
        product_result = await session.execute(
            select(ProductTemplate)
            .options(selectinload(ProductTemplate.images))
            .where(ProductTemplate.sku == STAGING_SKU)
        )
        product = product_result.scalar_one_or_none()

        if product is None:
            product = ProductTemplate(
                sku=STAGING_SKU,
                name="Staging Bootstrap Product",
                description=(
                    "A minimal launch-ready product created by the staging bootstrap script. "
                    "This product exists solely to satisfy the Playwright launch gate."
                ),
                category_id=category.id,
                brand="Elitedom",
                base_cost_usd=Decimal("50.00"),
                target_margin_percent=Decimal("30.00"),
                list_price=Decimal("1500.00"),
                stock_qty=10,
                tracking="serial",
                is_dropship_enabled=False,
                is_active=True,
                warranty_months=12,
            )
            session.add(product)
            await session.flush()
            summary["product_created"] = True

        # Create product catalog content (published)
        content_result = await session.execute(
            select(ProductCatalogContent).where(
                ProductCatalogContent.product_id == product.id
            )
        )
        content = content_result.scalar_one_or_none()

        if content is None:
            content = ProductCatalogContent(
                product_id=product.id,
                slug=STAGING_PRODUCT_SLUG,
                short_description="Staging bootstrap product for launch gate.",
                publication_status="published",
                published_at=datetime.now(timezone.utc),
            )
            session.add(content)
        elif content.publication_status != "published":
            content.publication_status = "published"
            content.published_at = datetime.now(timezone.utc)

        # Create product image (exactly one primary)
        image_result = await session.execute(
            select(ProductImage).where(ProductImage.product_id == product.id)
        )
        existing_images = image_result.scalars().all()

        if not existing_images:
            media_root = Path(settings.media_root)
            image_url = _write_tiny_png(media_root, product.id)

            session.add(
                ProductImage(
                    product_id=product.id,
                    url=image_url,
                    alt_text="Staging Bootstrap Product",
                    sort_order=0,
                    is_primary=True,
                )
            )
            summary["image_created"] = True

        # Create supplier link (required for publishable check)
        supplier_link = await session.scalar(
            select(ProductSupplier).where(
                ProductSupplier.product_id == product.id,
                ProductSupplier.supplier_id == supplier.id,
            )
        )
        if supplier_link is None:
            session.add(
                ProductSupplier(
                    product_id=product.id,
                    supplier_id=supplier.id,
                    supplier_sku=product.sku,
                    unit_cost_usd=product.base_cost_usd,
                    lead_time_days=supplier.lead_time_days,
                    is_active=True,
                    is_primary=False,
                )
            )

        await session.commit()

    return summary


async def verify_staging_catalog() -> dict[str, Any]:
    """Verify the staging catalog is launch-ready. Returns verification results."""
    settings = get_settings()
    results: dict[str, Any] = {"launch_ready": False, "checks": {}}

    async with async_session_factory() as session:
        # Check product exists and is active
        product = await session.scalar(
            select(ProductTemplate)
            .options(
                selectinload(ProductTemplate.images),
                selectinload(ProductTemplate.category),
            )
            .where(ProductTemplate.sku == STAGING_SKU)
        )

        if product is None:
            results["checks"]["product_exists"] = False
            return results

        results["checks"]["product_exists"] = True
        results["checks"]["is_active"] = product.is_active
        results["checks"]["has_name"] = bool(product.name)
        results["checks"]["has_sku"] = bool(product.sku)
        results["checks"]["positive_price"] = product.list_price > 0
        results["checks"]["has_stock"] = product.stock_qty > 0 or product.is_dropship_enabled

        # Check category
        results["checks"]["has_category"] = product.category is not None
        if product.category:
            results["checks"]["category_slug"] = product.category.slug
            results["checks"]["category_name"] = product.category.name

        # Check images
        images = product.images
        results["checks"]["image_count"] = len(images)
        results["checks"]["has_primary_image"] = any(img.is_primary for img in images)
        results["checks"]["no_template_images"] = all(
            "/template/images/" not in (img.url or "") for img in images
        )

        # Check catalog content
        content = await session.scalar(
            select(ProductCatalogContent).where(
                ProductCatalogContent.product_id == product.id
            )
        )
        if content:
            results["checks"]["has_slug"] = bool(content.slug)
            results["checks"]["publication_status"] = content.publication_status
        else:
            results["checks"]["has_slug"] = False
            results["checks"]["publication_status"] = "missing"

        # Check supplier link
        supplier_link = await session.scalar(
            select(ProductSupplier).where(ProductSupplier.product_id == product.id)
        )
        results["checks"]["has_supplier"] = supplier_link is not None

        # Overall launch readiness
        results["launch_ready"] = all([
            results["checks"]["product_exists"],
            results["checks"]["is_active"],
            results["checks"]["has_name"],
            results["checks"]["has_sku"],
            results["checks"]["positive_price"],
            results["checks"]["has_stock"],
            results["checks"]["has_category"],
            results["checks"]["image_count"] >= 1,
            results["checks"]["has_primary_image"],
            results["checks"]["no_template_images"],
            results["checks"]["has_slug"],
            results["checks"]["publication_status"] == "published",
            results["checks"]["has_supplier"],
        ])

    return results


async def main() -> None:
    """Run bootstrap and verification."""
    try:
        print("Bootstrapping staging catalogue...")
        summary = await bootstrap_staging_catalog()
        print(f"Bootstrap complete: {summary}")

        print("\nVerifying launch readiness...")
        verification = await verify_staging_catalog()
        print(f"Verification: {verification}")

        if verification["launch_ready"]:
            print("\n✓ Staging catalogue is launch-ready.")
        else:
            print("\n✗ Staging catalogue is NOT launch-ready.")
            failed = [k for k, v in verification["checks"].items() if not v]
            print(f"  Failed checks: {failed}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
