"""Published catalogue records must have an explicit verified source."""

from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Supplier
from app.modules.products.schemas import ProductCreateRequest, ProductUpdateRequest
from app.modules.products.service import ProductService
from app.modules.suppliers.dropship import ProductSupplierService
from app.modules.suppliers.schemas import ProductSupplierUpsertRequest
from app.shared.exceptions import ResourceConflictError


@pytest.mark.asyncio
async def test_draft_product_needs_verified_supplier_before_publication(
    db_session: AsyncSession,
) -> None:
    products = ProductService(db_session)
    draft = await products.create_product(
        ProductCreateRequest(
            name="Verified sourcing test product",
            sku="VERIFY-SOURCE-001",
            base_cost_usd=Decimal("20.00"),
            target_margin_percent=Decimal("25.00"),
            list_price=Decimal("1500.00"),
        )
    )
    assert not draft.is_active

    with pytest.raises(ResourceConflictError):
        await products.update_product(draft.id, ProductUpdateRequest(is_active=True))

    supplier = Supplier(
        name="Verified Supplier",
        email="verified-supplier@example.com",
        is_active=True,
        is_verified=True,
    )
    db_session.add(supplier)
    await db_session.flush()
    await ProductSupplierService(db_session).upsert_product_supplier(
        supplier_id=supplier.id,
        product_id=draft.id,
        request=ProductSupplierUpsertRequest(
            supplier_sku="VERIFY-SOURCE-001",
            unit_cost_usd=Decimal("20.00"),
            is_primary=False,
            is_active=True,
        ),
    )

    published = await products.update_product(draft.id, ProductUpdateRequest(is_active=True))
    assert published.is_active
