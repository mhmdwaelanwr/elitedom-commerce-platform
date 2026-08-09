"""Stage 8 integration coverage for bilingual catalogue content and rich media."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import select

from app.models import (
    Partner,
    ProductCategory,
    ProductImage,
    ProductSupplier,
    ProductTemplate,
    Supplier,
)
from app.modules.admin.models import AdminAuditLog
from app.modules.auth.models import AuthSession
from app.modules.products.catalog_models import (
    CategoryCatalogContent,
    ProductAttributeDefinition,
    ProductAttributeValue,
    ProductCatalogContent,
)
from app.shared.security import create_access_token

pytestmark = pytest.mark.asyncio

_SESSION_IDS: dict[int, str] = {}


def _authorization(partner: Partner, *, token_role: str | None = None) -> dict[str, str]:
    token = create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": token_role or partner.role,
            "sid": _SESSION_IDS[partner.id],
        }
    )
    return {"Authorization": f"Bearer {token}"}


async def _partner(db_session, *, email: str, role: str) -> Partner:
    partner = Partner(
        name=email.split("@", 1)[0],
        email=email,
        phone=f"010{abs(hash(email)) % 10_000_000:07d}",
        role=role,
        company_type="person",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    session_id = str(uuid4())
    db_session.add(
        AuthSession(
            id=session_id,
            partner_id=partner.id,
            refresh_token_hash="0" * 64,
            auth_method="test",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
    )
    await db_session.flush()
    _SESSION_IDS[partner.id] = session_id
    return partner


async def _category(db_session, *, slug: str = "laptops") -> ProductCategory:
    category = ProductCategory(
        name="Laptops",
        slug=slug,
        description="Portable computers",
        sort_order=10,
        is_active=True,
    )
    db_session.add(category)
    await db_session.flush()
    return category


async def _product(
    db_session,
    *,
    category: ProductCategory,
    sku: str,
    active: bool,
) -> ProductTemplate:
    product = ProductTemplate(
        name="Creator Laptop",
        sku=sku,
        description="Fast portable workstation",
        tracking="serial",
        base_cost_usd=Decimal("800.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("55000.00"),
        category_id=category.id,
        brand="Elitedom",
        is_dropship_enabled=False,
        is_active=active,
        stock_qty=7,
        warranty_months=24,
        power_wattage_draw=90,
    )
    db_session.add(product)
    await db_session.flush()
    return product


async def test_public_catalog_localizes_content_and_dynamic_attributes(client, db_session):
    category = await _category(db_session)
    db_session.add(
        CategoryCatalogContent(
            category_id=category.id,
            name_ar="أجهزة لابتوب",
            description_ar="أجهزة كمبيوتر محمولة",
            is_featured=True,
        )
    )
    product = await _product(
        db_session,
        category=category,
        sku="STAGE8-LAPTOP-1",
        active=True,
    )
    db_session.add(
        ProductCatalogContent(
            product_id=product.id,
            slug="creator-laptop",
            short_description="Portable creator machine",
            name_ar="لابتوب للمبدعين",
            short_description_ar="جهاز محمول لصناع المحتوى",
            description_ar="محطة عمل محمولة سريعة",
            seo_title="Creator Laptop | Elitedom",
            seo_title_ar="لابتوب للمبدعين | إليت دوم",
            publication_status="published",
            is_featured=True,
        )
    )
    db_session.add(
        ProductImage(
            product_id=product.id,
            url="https://cdn.example.com/catalog/creator.webp",
            alt_text="Creator Laptop",
            sort_order=0,
            is_primary=True,
        )
    )
    attribute = ProductAttributeDefinition(
        code="screen_size",
        name="Screen size",
        name_ar="حجم الشاشة",
        data_type="number",
        unit="in",
        unit_ar="بوصة",
        is_filterable=True,
        is_active=True,
        sort_order=10,
    )
    db_session.add(attribute)
    await db_session.flush()
    db_session.add(
        ProductAttributeValue(
            product_id=product.id,
            attribute_id=attribute.id,
            value_number=Decimal("16"),
            sort_order=10,
        )
    )
    await db_session.flush()

    arabic = await client.get("/api/v1/catalog/products?locale=ar&featured=true")
    english = await client.get("/api/v1/catalog/products/creator-laptop?locale=en")

    assert arabic.status_code == 200
    assert arabic.json()["total_count"] == 1
    ar_product = arabic.json()["products"][0]
    assert ar_product["slug"] == "creator-laptop"
    assert ar_product["name"] == "لابتوب للمبدعين"
    assert ar_product["category"]["name"] == "أجهزة لابتوب"
    assert ar_product["attributes"][0]["label"] == "حجم الشاشة"
    assert ar_product["attributes"][0]["value"] == "16"
    assert ar_product["attributes"][0]["unit"] == "بوصة"

    assert english.status_code == 200
    assert english.json()["name"] == "Creator Laptop"
    assert english.json()["attributes"][0]["label"] == "Screen size"


async def test_public_catalog_hides_draft_content(client, db_session):
    category = await _category(db_session, slug="draft-category")
    product = await _product(
        db_session,
        category=category,
        sku="STAGE8-DRAFT-1",
        active=False,
    )
    db_session.add(
        ProductCatalogContent(
            product_id=product.id,
            slug="draft-product",
            publication_status="draft",
            is_featured=False,
        )
    )
    await db_session.flush()

    listing = await client.get("/api/v1/catalog/products")
    detail = await client.get("/api/v1/catalog/products/draft-product")

    assert listing.status_code == 200
    assert listing.json()["total_count"] == 0
    assert detail.status_code == 404


async def test_catalog_admin_uses_persisted_permissions_and_audits_content_changes(
    client,
    db_session,
):
    customer = await _partner(
        db_session,
        email="catalog-customer-stage8@example.com",
        role="customer",
    )
    admin = await _partner(
        db_session,
        email="catalog-admin-stage8@example.com",
        role="system_admin",
    )
    category = await _category(db_session, slug="admin-content")
    product = await _product(
        db_session,
        category=category,
        sku="STAGE8-ADMIN-1",
        active=False,
    )
    db_session.add(
        ProductCatalogContent(
            product_id=product.id,
            slug="stage8-admin-product",
            publication_status="draft",
            is_featured=False,
        )
    )
    await db_session.flush()

    stale_claim = await client.put(
        f"/api/v1/admin/catalog/products/{product.id}/content",
        headers=_authorization(customer, token_role="system_admin"),
        json={"name_ar": "اسم غير مسموح"},
    )
    updated = await client.put(
        f"/api/v1/admin/catalog/products/{product.id}/content",
        headers=_authorization(admin),
        json={
            "name_ar": "منتج الإدارة",
            "short_description": "Editorial summary",
            "short_description_ar": "ملخص تحريري",
            "seo_title": "Admin Product | Elitedom",
            "publication_status": "draft",
            "is_featured": True,
        },
    )

    assert stale_claim.status_code == 403
    assert updated.status_code == 200
    assert updated.json()["name_ar"] == "منتج الإدارة"
    assert updated.json()["is_featured"] is True

    audit = await db_session.scalar(
        select(AdminAuditLog).where(
            AdminAuditLog.action == "catalog.content.update",
            AdminAuditLog.entity_id == str(product.id),
        )
    )
    assert audit is not None
    assert audit.actor_partner_id == admin.id
    assert audit.after_summary["name_ar"] == "منتج الإدارة"


async def test_publish_requires_sourcing_and_image_then_becomes_public(client, db_session):
    admin = await _partner(
        db_session,
        email="publisher-stage8@example.com",
        role="system_admin",
    )
    category = await _category(db_session, slug="publishable")
    product = await _product(
        db_session,
        category=category,
        sku="STAGE8-PUBLISH-1",
        active=False,
    )
    db_session.add(
        ProductCatalogContent(
            product_id=product.id,
            slug="publishable-product",
            publication_status="draft",
            is_featured=False,
        )
    )
    await db_session.flush()

    blocked = await client.put(
        f"/api/v1/admin/catalog/products/{product.id}/content",
        headers=_authorization(admin),
        json={"publication_status": "published"},
    )
    assert blocked.status_code == 409

    supplier = Supplier(
        name="Stage 8 Supplier",
        email="supplier-stage8@example.com",
        is_active=True,
        is_verified=True,
    )
    db_session.add(supplier)
    await db_session.flush()
    db_session.add(
        ProductSupplier(
            product_id=product.id,
            supplier_id=supplier.id,
            supplier_sku="SUP-STAGE8-1",
            unit_cost_usd=Decimal("800.00"),
            is_primary=False,
            is_active=True,
        )
    )
    db_session.add(
        ProductImage(
            product_id=product.id,
            url="https://cdn.example.com/catalog/publishable.webp",
            alt_text="Publishable",
            sort_order=0,
            is_primary=True,
        )
    )
    await db_session.flush()

    published = await client.put(
        f"/api/v1/admin/catalog/products/{product.id}/content",
        headers=_authorization(admin),
        json={"publication_status": "published"},
    )
    public = await client.get("/api/v1/catalog/products/publishable-product")

    assert published.status_code == 200
    assert published.json()["publication_status"] == "published"
    assert published.json()["published_at"] is not None
    assert public.status_code == 200


async def test_category_cycles_are_rejected(client, db_session):
    admin = await _partner(
        db_session,
        email="category-admin-stage8@example.com",
        role="system_admin",
    )
    headers = _authorization(admin)
    parent = await client.post(
        "/api/v1/admin/catalog/categories",
        headers=headers,
        json={"name": "Components", "slug": "components", "sort_order": 1},
    )
    assert parent.status_code == 201
    child = await client.post(
        "/api/v1/admin/catalog/categories",
        headers=headers,
        json={
            "name": "Processors",
            "slug": "processors",
            "parent_id": parent.json()["id"],
            "sort_order": 1,
        },
    )
    assert child.status_code == 201

    cycle = await client.put(
        f"/api/v1/admin/catalog/categories/{parent.json()['id']}",
        headers=headers,
        json={
            "name": "Components",
            "slug": "components",
            "parent_id": child.json()["id"],
            "sort_order": 1,
        },
    )
    assert cycle.status_code == 409


async def test_media_upload_records_verified_metadata_and_rejects_duplicate(client, db_session):
    admin = await _partner(
        db_session,
        email="media-admin-stage8@example.com",
        role="system_admin",
    )
    category = await _category(db_session, slug="media")
    product = await _product(
        db_session,
        category=category,
        sku="STAGE8-MEDIA-1",
        active=False,
    )
    buffer = BytesIO()
    Image.new("RGB", (24, 16), (20, 40, 60)).save(buffer, format="PNG")
    image_bytes = buffer.getvalue()
    headers = _authorization(admin)

    first = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        headers=headers,
        files={"image": ("stage8.png", image_bytes, "image/png")},
        data={
            "alt_text": "Stage 8 image",
            "caption": "Front view",
            "caption_ar": "الواجهة الأمامية",
            "is_primary": "true",
        },
    )
    duplicate = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        headers=headers,
        files={"image": ("duplicate.png", image_bytes, "image/png")},
        data={"is_primary": "false"},
    )

    assert first.status_code == 201
    body = first.json()
    assert body["mime_type"] == "image/png"
    assert body["width"] == 24
    assert body["height"] == 16
    assert body["byte_size"] == len(image_bytes)
    assert len(body["sha256"]) == 64
    assert body["storage_provider"] == "local"
    assert duplicate.status_code == 409

    deleted = await client.delete(
        f"/api/v1/admin/catalog/products/{product.id}/media/{body['id']}",
        headers=headers,
    )
    assert deleted.status_code == 204
