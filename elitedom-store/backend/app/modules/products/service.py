"""
Elitedom Store — Products Module Service
Business logic for product catalog management with Algolia sync.
"""

import logging
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductCategory, ProductSupplier, ProductTemplate, Supplier
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductListResponse,
    ProductSummaryResponse,
    ProductUpdateRequest,
)
from app.shared.events import ProductCreated, ProductUpdated
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event

logger = logging.getLogger(__name__)


class ProductService:
    """Product catalog business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_products(
        self,
        category_id: Optional[int] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        in_stock: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> ProductListResponse:
        """Fetch paginated and filtered product catalog."""
        query = (
            select(ProductTemplate)
            .options(selectinload(ProductTemplate.images))
            .where(ProductTemplate.is_active.is_(True))
        )

        # Apply filters
        if category_id is not None:
            query = query.where(ProductTemplate.category_id == category_id)
        if brand is not None:
            query = query.where(ProductTemplate.brand.ilike(f"%{brand}%"))
        if min_price is not None:
            query = query.where(ProductTemplate.list_price >= min_price)
        if max_price is not None:
            query = query.where(ProductTemplate.list_price <= max_price)
        if in_stock is True:
            query = query.where(ProductTemplate.stock_qty > 0)
        elif in_stock is False:
            query = query.where(ProductTemplate.stock_qty == 0)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # Paginate
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit).order_by(ProductTemplate.name)

        result = await self.db.execute(query)
        products = result.scalars().all()

        return ProductListResponse(
            total_count=total,
            page=page,
            limit=limit,
            products=[ProductSummaryResponse.model_validate(p) for p in products],
        )

    async def search_products(
        self, query: str, page: int = 1, limit: int = 20
    ) -> ProductListResponse:
        """
        Search products — falls back to a local multi-field search when Algolia
        is not configured. The fallback covers the same shopper-visible fields
        rather than silently limiting search to product names.
        FR-CAT-002: Typo-tolerant search via Algolia.
        """
        normalized_query = query.strip()
        search_query = (
            select(ProductTemplate)
            .options(selectinload(ProductTemplate.images))
            .where(
                and_(
                    ProductTemplate.is_active.is_(True),
                    or_(
                        ProductTemplate.name.ilike(f"%{normalized_query}%"),
                        ProductTemplate.sku.ilike(f"%{normalized_query}%"),
                        ProductTemplate.brand.ilike(f"%{normalized_query}%"),
                        ProductTemplate.description.ilike(f"%{normalized_query}%"),
                    ),
                )
            )
        )

        count_query = select(func.count()).select_from(search_query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        offset = (page - 1) * limit
        search_query = search_query.offset(offset).limit(limit)

        result = await self.db.execute(search_query)
        products = result.scalars().all()

        return ProductListResponse(
            total_count=total,
            page=page,
            limit=limit,
            products=[ProductSummaryResponse.model_validate(p) for p in products],
        )

    async def get_product_detail(self, product_id: int) -> ProductDetailResponse:
        """Get detailed product page with images and specs."""
        result = await self.db.execute(
            select(ProductTemplate)
            .options(selectinload(ProductTemplate.images))
            .where(
                ProductTemplate.id == product_id,
                ProductTemplate.is_active.is_(True),
            )
        )
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError("Product", product_id)

        return ProductDetailResponse.model_validate(product)

    async def get_category_tree(self) -> list[dict]:
        """Build the hierarchical category tree."""
        result = await self.db.execute(
            select(ProductCategory)
            .where(ProductCategory.is_active.is_(True))
            .order_by(ProductCategory.sort_order)
        )
        categories = result.scalars().all()

        # Build tree structure
        category_map: dict[int, dict] = {}
        roots: list[dict] = []
        for cat in categories:
            category_map[cat.id] = {
                "id": cat.id,
                "name": cat.name,
                "slug": cat.slug,
                "children": [],
            }

        for cat in categories:
            node = category_map[cat.id]
            if cat.parent_id is None or cat.parent_id not in category_map:
                roots.append(node)
            else:
                category_map[cat.parent_id]["children"].append(node)

        return roots

    async def create_product(self, request: ProductCreateRequest) -> ProductDetailResponse:
        """Create a draft product; verified sourcing is required before publish."""
        if request.is_active:
            raise ResourceConflictError(
                "Create new products as drafts, add a verified supplier mapping, then publish them."
            )
        product = ProductTemplate(**request.model_dump())
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product, attribute_names=["images"])

        # Publish domain event — triggers Algolia indexing + Odoo sync
        await publish_domain_event(
            self.db, ProductCreated(payload={"product_id": product.id, "sku": product.sku})
        )

        logger.info(f"Product created: {product.sku} (ID: {product.id})")
        return ProductDetailResponse.model_validate(product)

    async def update_product(
        self, product_id: int, request: ProductUpdateRequest
    ) -> ProductDetailResponse:
        """Update product details and trigger re-indexing."""
        result = await self.db.execute(
            select(ProductTemplate).where(ProductTemplate.id == product_id)
        )
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError("Product", product_id)

        update_data = request.model_dump(exclude_unset=True)
        publishing = update_data.get("is_active") is True and not product.is_active
        enabling_dropship = (
            update_data.get("is_dropship_enabled") is True and not product.is_dropship_enabled
        )
        if publishing:
            await self._assert_verified_supplier_mapping(
                product.id,
                requires_primary_dropship=bool(
                    update_data.get("is_dropship_enabled", product.is_dropship_enabled)
                ),
            )
        elif enabling_dropship and product.is_active:
            await self._assert_verified_supplier_mapping(
                product.id,
                requires_primary_dropship=True,
            )
        for field, value in update_data.items():
            setattr(product, field, value)

        await self.db.flush()
        # ``updated_at`` is database-managed and can be expired after flush;
        # refresh it before Pydantic reads the ORM object in async code.
        await self.db.refresh(product)
        await self.db.refresh(product, attribute_names=["images"])

        await publish_domain_event(
            self.db, ProductUpdated(payload={"product_id": product.id, "sku": product.sku})
        )

        return ProductDetailResponse.model_validate(product)

    async def delete_product(self, product_id: int) -> None:
        """Soft-delete a product by setting is_active=False."""
        result = await self.db.execute(
            select(ProductTemplate).where(ProductTemplate.id == product_id)
        )
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError("Product", product_id)

        product.is_active = False
        await self.db.flush()
        await publish_domain_event(
            self.db,
            ProductUpdated(payload={"product_id": product.id, "sku": product.sku}),
        )
        logger.info(f"Product soft-deleted: {product.sku} (ID: {product.id})")

    async def _assert_verified_supplier_mapping(
        self, product_id: int, *, requires_primary_dropship: bool
    ) -> None:
        """Enforce the published-catalogue sourcing rule from BUSINESS_REQUIREMENTS."""
        conditions = [
            ProductSupplier.product_id == product_id,
            ProductSupplier.is_active.is_(True),
            Supplier.is_active.is_(True),
            Supplier.is_verified.is_(True),
        ]
        if requires_primary_dropship:
            conditions.append(ProductSupplier.is_primary.is_(True))
        link = await self.db.scalar(
            select(ProductSupplier.id)
            .join(Supplier, Supplier.id == ProductSupplier.supplier_id)
            .where(*conditions)
            .limit(1)
        )
        if link is None:
            route = (
                "a verified primary dropship supplier"
                if requires_primary_dropship
                else "a verified supplier"
            )
            raise ResourceConflictError(f"This product needs {route} before it can be published.")
