"""Create a useful local catalog without overwriting operational data.

This command intentionally only inserts records that do not already exist by
unique slug/SKU.  It makes the first local storefront and admin-console run
usable while keeping real catalogue imports authoritative.
"""

from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory, engine
from app.models import ProductCategory, ProductImage, ProductSupplier, ProductTemplate, Supplier

CATEGORIES: tuple[dict[str, Any], ...] = (
    {
        "slug": "gaming",
        "name": "Gaming & Controllers",
        "description": "Controllers, gaming accessories, and performance gear.",
        "sort_order": 10,
    },
    {
        "slug": "computers",
        "name": "Laptops & PCs",
        "description": "Laptops, workstations, and custom systems.",
        "sort_order": 20,
    },
    {
        "slug": "peripherals",
        "name": "Peripherals",
        "description": "Mice, keyboards, and productivity essentials.",
        "sort_order": 30,
    },
    {
        "slug": "audio",
        "name": "Audio",
        "description": "Headsets and headphones for work, play, and calls.",
        "sort_order": 40,
    },
    {
        "slug": "networking",
        "name": "Networking",
        "description": "Routers and connectivity gear for homes and teams.",
        "sort_order": 50,
    },
    {
        "slug": "mobile",
        "name": "Mobile & Tablets",
        "description": "Mobile devices, tablets, and practical accessories.",
        "sort_order": 60,
    },
)


PRODUCTS: tuple[dict[str, Any], ...] = (
    {
        "sku": "HAV-HVG69",
        "name": "Havit HV-G69 USB Gamepad",
        "description": (
            "A dependable plug-and-play controller for PC gaming with dual analogue "
            "sticks and responsive action buttons."
        ),
        "category": "gaming",
        "brand": "Havit",
        "base_cost_usd": "18.00",
        "target_margin_percent": "35.00",
        "list_price": "1290.00",
        "stock_qty": 18,
        "tracking": "barcode",
        "warranty_months": 12,
        "images": (
            "/template/images/products/product-1-bg-1.png",
            "/template/images/products/product-1-bg-2.png",
        ),
    },
    {
        "sku": "LOG-MX-M3S",
        "name": "Logitech MX Master 3S Wireless Mouse",
        "description": (
            "A precision productivity mouse with quiet clicks, MagSpeed scrolling, "
            "and multi-device Bluetooth pairing."
        ),
        "category": "peripherals",
        "brand": "Logitech",
        "base_cost_usd": "78.00",
        "target_margin_percent": "30.00",
        "list_price": "4890.00",
        "stock_qty": 9,
        "tracking": "barcode",
        "warranty_months": 24,
        "images": (
            "/template/images/products/product-6-bg-1.png",
            "/template/images/products/product-6-bg-2.png",
        ),
    },
    {
        "sku": "ASU-RT-AX57",
        "name": "ASUS RT-AX57 WiFi 6 Router",
        "description": (
            "Whole-home WiFi 6 coverage with secure networking and stable performance "
            "for streaming and gaming."
        ),
        "category": "networking",
        "brand": "ASUS",
        "base_cost_usd": "105.00",
        "target_margin_percent": "28.00",
        "list_price": "6290.00",
        "stock_qty": 6,
        "tracking": "serial",
        "is_dropship_enabled": True,
        "warranty_months": 24,
        "images": ("/template/images/products/product-8-bg-1.png",),
    },
    {
        "sku": "ELD-AETHER-V4",
        "name": "Elitedom Aetherium Rig v4",
        "description": (
            "A bespoke liquid-cooled gaming system, assembled and stress-tested by "
            "Elitedom technicians."
        ),
        "category": "computers",
        "brand": "Elitedom",
        "base_cost_usd": "3250.00",
        "target_margin_percent": "24.00",
        "list_price": "185000.00",
        "stock_qty": 3,
        "tracking": "serial",
        "warranty_months": 36,
        "ram_type": "DDR5",
        "form_factor": "ATX",
        "power_wattage_draw": 850,
        "pcie_gen": "PCIe 5.0",
        "images": (
            "/template/images/products/product-3-bg-1.png",
            "/template/images/products/product-3-bg-2.png",
        ),
    },
    {
        "sku": "APP-MBA-M1",
        "name": "MacBook Air M1, 8GB / 256GB",
        "description": (
            "A lightweight everyday laptop with Apple silicon performance, long battery "
            "life, and a crisp Retina display."
        ),
        "category": "computers",
        "brand": "Apple",
        "base_cost_usd": "760.00",
        "target_margin_percent": "20.00",
        "list_price": "42990.00",
        "stock_qty": 4,
        "tracking": "serial",
        "is_dropship_enabled": True,
        "warranty_months": 12,
        "images": (
            "/template/images/products/product-4-bg-1.png",
            "/template/images/products/product-4-bg-2.png",
        ),
    },
    {
        "sku": "ELD-PRO-WS16",
        "name": "Elitedom Titan Workstation Pro 16",
        "description": (
            "A mobile workstation for creative professionals and engineers who need "
            "dependable all-day performance."
        ),
        "category": "computers",
        "brand": "Elitedom Pro",
        "base_cost_usd": "2500.00",
        "target_margin_percent": "25.00",
        "list_price": "140000.00",
        "stock_qty": 2,
        "tracking": "serial",
        "warranty_months": 36,
        "ram_type": "DDR5",
        "form_factor": "Laptop",
        "power_wattage_draw": 230,
        "pcie_gen": "PCIe 4.0",
        "images": (
            "/template/images/products/product-5-bg-1.png",
            "/template/images/products/product-5-bg-2.png",
        ),
    },
    {
        "sku": "BEATS-STUDIO-WL",
        "name": "Studio Wireless Noise-Cancelling Headphones",
        "description": (
            "Immersive wireless audio with adaptive noise cancellation for focused work, "
            "travel, and entertainment."
        ),
        "category": "audio",
        "brand": "Studio",
        "base_cost_usd": "150.00",
        "target_margin_percent": "30.00",
        "list_price": "8990.00",
        "stock_qty": 12,
        "tracking": "barcode",
        "warranty_months": 12,
        "images": ("/template/images/hero/hero-01.png",),
    },
    {
        "sku": "APP-IPAD-AIR5",
        "name": "iPad Air 5th Gen, 64GB",
        "description": (
            "A versatile tablet for notes, customer presentations, entertainment, and "
            "lightweight creative work."
        ),
        "category": "mobile",
        "brand": "Apple",
        "base_cost_usd": "580.00",
        "target_margin_percent": "18.00",
        "list_price": "32990.00",
        "stock_qty": 0,
        "tracking": "serial",
        "is_dropship_enabled": True,
        "warranty_months": 12,
        "images": (
            "/template/images/products/product-7-bg-1.png",
            "/template/images/products/product-7-bg-2.png",
        ),
    },
)


async def seed_demo_catalog() -> tuple[int, int]:
    """Insert missing categories/products and return their inserted counts."""
    settings = get_settings()
    if settings.environment != "development":
        raise RuntimeError("Demo data can only be seeded in the development environment.")

    inserted_categories = 0
    inserted_products = 0
    async with async_session_factory() as session:
        demo_supplier = await session.scalar(
            select(Supplier).where(Supplier.email == "demo-supplier@elitedom.local")
        )
        if demo_supplier is None:
            demo_supplier = Supplier(
                name="Elitedom Demo Supplier",
                contact_name="Local development data",
                email="demo-supplier@elitedom.local",
                lead_time_days=2,
                is_active=True,
                is_verified=True,
            )
            session.add(demo_supplier)
        else:
            # The local demo supplier is owned by this seed command; ensure a
            # migration from an older demo dataset remains usable.
            demo_supplier.is_active = True
            demo_supplier.is_verified = True
        await session.flush()

        category_result = await session.execute(select(ProductCategory))
        categories = {category.slug: category for category in category_result.scalars()}

        for definition in CATEGORIES:
            if definition["slug"] in categories:
                continue
            category = ProductCategory(**definition)
            session.add(category)
            categories[category.slug] = category
            inserted_categories += 1

        await session.flush()

        for definition in PRODUCTS:
            product_result = await session.execute(
                select(ProductTemplate)
                .options(selectinload(ProductTemplate.images))
                .where(ProductTemplate.sku == definition["sku"])
            )
            product = product_result.scalar_one_or_none()
            if product is None:
                product = ProductTemplate(
                    sku=definition["sku"],
                    name=definition["name"],
                    description=definition["description"],
                    category_id=categories[definition["category"]].id,
                    brand=definition["brand"],
                    base_cost_usd=Decimal(definition["base_cost_usd"]),
                    target_margin_percent=Decimal(definition["target_margin_percent"]),
                    list_price=Decimal(definition["list_price"]),
                    stock_qty=definition["stock_qty"],
                    tracking=definition.get("tracking", "serial"),
                    is_dropship_enabled=definition.get("is_dropship_enabled", False),
                    warranty_months=definition.get("warranty_months", 12),
                    socket_type=definition.get("socket_type"),
                    ram_type=definition.get("ram_type"),
                    form_factor=definition.get("form_factor"),
                    power_wattage_draw=definition.get("power_wattage_draw", 0),
                    pcie_gen=definition.get("pcie_gen"),
                )
                session.add(product)
                await session.flush()
                inserted_products += 1

            image_result = await session.execute(
                select(ProductImage.url).where(ProductImage.product_id == product.id)
            )
            existing_urls = set(image_result.scalars())
            for index, image_url in enumerate(definition["images"]):
                if image_url in existing_urls:
                    continue
                session.add(
                    ProductImage(
                        product_id=product.id,
                        url=image_url,
                        alt_text=product.name,
                        sort_order=index,
                        is_primary=index == 0,
                    )
                )

            supplier_link = await session.scalar(
                select(ProductSupplier).where(
                    ProductSupplier.product_id == product.id,
                    ProductSupplier.supplier_id == demo_supplier.id,
                )
            )
            if supplier_link is None:
                session.add(
                    ProductSupplier(
                        product_id=product.id,
                        supplier_id=demo_supplier.id,
                        supplier_sku=product.sku,
                        unit_cost_usd=product.base_cost_usd,
                        lead_time_days=demo_supplier.lead_time_days,
                        is_active=True,
                        is_primary=product.is_dropship_enabled,
                    )
                )

        await session.commit()

    return inserted_categories, inserted_products


async def main() -> None:
    try:
        categories, products = await seed_demo_catalog()
        print("Demo catalog ready: " f"{categories} categories and {products} products inserted.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
