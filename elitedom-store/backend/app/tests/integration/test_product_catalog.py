"""Integration coverage for catalog images, search, and category hierarchy."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent, ProductCategory, ProductImage, ProductTemplate
from app.modules.products.service import ProductService


async def _product(
    db: AsyncSession,
    *,
    sku: str,
    name: str,
    category_id: int | None = None,
) -> ProductTemplate:
    product = ProductTemplate(
        name=name,
        sku=sku,
        description=f"Verified product description for {name}",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
        category_id=category_id,
        brand="Elitedom",
    )
    db.add(product)
    await db.flush()
    return product


@pytest.mark.asyncio
async def test_catalog_list_and_search_include_images_and_sku_matches(
    db_session: AsyncSession,
) -> None:
    product = await _product(
        db_session,
        sku="ASU-RT-AX57",
        name="ASUS WiFi 6 Router",
    )
    db_session.add(
        ProductImage(
            product_id=product.id,
            url="/template/images/products/product-8-bg-1.png",
            alt_text=product.name,
            is_primary=True,
        )
    )
    await db_session.flush()

    service = ProductService(db_session)
    listed = await service.list_products()
    assert listed.total_count == 1
    assert listed.products[0].images[0].url.endswith("product-8-bg-1.png")

    searched = await service.search_products("ASU")
    assert searched.total_count == 1
    assert searched.products[0].sku == "ASU-RT-AX57"


@pytest.mark.asyncio
async def test_category_tree_is_correct_when_child_sorts_before_parent(
    db_session: AsyncSession,
) -> None:
    parent = ProductCategory(name="Components", slug="components", sort_order=20)
    db_session.add(parent)
    await db_session.flush()
    child = ProductCategory(
        name="Graphics Cards",
        slug="graphics-cards",
        parent_id=parent.id,
        sort_order=10,
    )
    db_session.add(child)
    await db_session.flush()

    categories = await ProductService(db_session).get_category_tree()
    assert categories == [
        {
            "id": parent.id,
            "name": "Components",
            "slug": "components",
            "description": None,
            "is_active": True,
            "children": [
                {
                    "id": child.id,
                    "name": "Graphics Cards",
                    "slug": "graphics-cards",
                    "description": None,
                    "is_active": True,
                    "children": [],
                }
            ],
        }
    ]


@pytest.mark.asyncio
async def test_soft_delete_publishes_product_reindex_event(
    db_session: AsyncSession,
) -> None:
    product = await _product(
        db_session,
        sku="SOFT-DELETE-ALGOLIA-001",
        name="Soft-deleted catalog product",
    )

    await ProductService(db_session).delete_product(product.id)

    events = (
        await db_session.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.event_type == "ProductUpdated")
            .order_by(OutboxEvent.id.desc())
        )
    ).all()
    event = next(
        (candidate for candidate in events if candidate.payload.get("product_id") == product.id),
        None,
    )
    assert event is not None
    assert event.source_context == "product"
    assert event.payload == {"product_id": product.id, "sku": product.sku}
    assert product.is_active is False
