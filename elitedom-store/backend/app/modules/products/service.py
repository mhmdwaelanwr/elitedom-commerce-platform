"""Product catalogue commands and queries with durable integration events."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ProductCategory,
    ProductImage,
    ProductSupplier,
    ProductTemplate,
    Supplier,
)
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductImageResponse,
    ProductListResponse,
    ProductSummaryResponse,
    ProductUpdateRequest,
)
from app.shared.events import ProductCreated, ProductUpdated
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event

logger = logging.getLogger(__name__)


class ProductService:
    """Product catalogue business logic shared by public and staff APIs."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self, *, include_inactive: bool = False):
        query = select(ProductTemplate).options(
            selectinload(ProductTemplate.images),
            selectinload(ProductTemplate.category),
        )
        return query if include_inactive else query.where(ProductTemplate.is_active.is_(True))

    @staticmethod
    def _ordered_images(product: ProductTemplate) -> list[ProductImage]:
        return sorted(product.images, key=lambda image: (not image.is_primary, image.sort_order, image.id))

    def _detail(self, product: ProductTemplate) -> ProductDetailResponse:
        payload = ProductDetailResponse.model_validate(product).model_dump()
        payload["images"] = [
            ProductImageResponse.model_validate(image).model_dump()
            for image in self._ordered_images(product)
        ]
        return ProductDetailResponse.model_validate(payload)

    def _summary(self, product: ProductTemplate) -> ProductSummaryResponse:
        payload: dict[str, Any] = ProductSummaryResponse.model_validate(product).model_dump()
        payload["images"] = [
            ProductImageResponse.model_validate(image).model_dump()
            for image in self._ordered_images(product)
        ]
        return ProductSummaryResponse.model_validate(payload)

    async def list_products(
        self,
        category_id: int | None = None,
        brand: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        in_stock: bool | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> ProductListResponse:
        filters = []
        if category_id is not None:
            filters.append(ProductTemplate.category_id == category_id)
        if brand is not None:
            filters.append(ProductTemplate.brand.ilike(f"%{brand.strip()}%"))
        if min_price is not None:
            filters.append(ProductTemplate.list_price >= min_price)
        if max_price is not None:
            filters.append(ProductTemplate.list_price <= max_price)
        if in_stock is True:
            filters.append(or_(ProductTemplate.stock_qty > 0, ProductTemplate.is_dropship_enabled.is_(True)))
        elif in_stock is False:
            filters.extend(
                [
                    ProductTemplate.stock_qty == 0,
                    ProductTemplate.is_dropship_enabled.is_(False),
                ]
            )

        count_query = (
            select(func.count())
            .select_from(ProductTemplate)
            .where(ProductTemplate.is_active.is_(True), *filters)
        )
        total = int((await self.db.scalar(count_query)) or 0)
        result = await self.db.execute(
            self._base_query()
            .where(*filters)
            .order_by(ProductTemplate.updated_at.desc(), ProductTemplate.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        products = list(result.scalars().unique())
        return ProductListResponse(
            total_count=total,
            page=page,
            limit=limit,
            products=[self._summary(product) for product in products],
        )

    async def search_products(self, query: str, page: int = 1, limit: int = 20) -> ProductListResponse:
        normalized = query.strip()
        filters = [
            ProductTemplate.is_active.is_(True),
            or_(
                ProductTemplate.name.ilike(f"%{normalized}%"),
                ProductTemplate.sku.ilike(f"%{normalized}%"),
                ProductTemplate.brand.ilike(f"%{normalized}%"),
                ProductTemplate.description.ilike(f"%{normalized}%"),
            ),
        ]
        total = int(
            (await self.db.scalar(select(func.count()).select_from(ProductTemplate).where(*filters)))
            or 0
        )
        result = await self.db.execute(
            self._base_query(include_inactive=True)
            .where(*filters)
            .order_by(ProductTemplate.name)
            .offset((page - 1) * limit)
            .limit(limit)
        )
        products = list(result.scalars().unique())
        return ProductListResponse(
            total_count=total,
            page=page,
            limit=limit,
            products=[self._summary(product) for product in products],
        )

    async def get_product_detail(
        self, product_id: int, *, include_inactive: bool = False
    ) -> ProductDetailResponse:
        product = await self.db.scalar(
            self._base_query(include_inactive=include_inactive).where(ProductTemplate.id == product_id)
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        return self._detail(product)

    async def get_category_tree(self, *, include_inactive: bool = False) -> list[dict[str, Any]]:
        query = select(ProductCategory).order_by(ProductCategory.sort_order, ProductCategory.name)
        if not include_inactive:
            query = query.where(ProductCategory.is_active.is_(True))
        categories = list((await self.db.scalars(query)).all())
        category_map: dict[int, dict[str, Any]] = {
            category.id: {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "description": category.description,
                "is_active": category.is_active,
                "children": [],
            }
            for category in categories
        }
        roots: list[dict[str, Any]] = []
        for category in categories:
            node = category_map[category.id]
            parent = category_map.get(category.parent_id or -1)
            (parent["children"] if parent else roots).append(node)
        return roots

    async def create_product(self, request: ProductCreateRequest) -> ProductDetailResponse:
        if request.is_active:
            raise ResourceConflictError(
                "Create staff-managed products as drafts, attach verified sourcing, then publish them."
            )
        if await self.db.scalar(select(ProductTemplate.id).where(ProductTemplate.sku == request.sku)):
            raise ResourceConflictError(f"A product with SKU {request.sku} already exists.")
        if request.category_id is not None:
            await self._require_category(request.category_id)

        product = ProductTemplate(**request.model_dump())
        self.db.add(product)
        await self.db.flush()
        await self._publish(product, created=True)
        return await self.get_product_detail(product.id, include_inactive=True)

    async def update_product(
        self, product_id: int, request: ProductUpdateRequest
    ) -> ProductDetailResponse:
        product = await self.db.scalar(
            select(ProductTemplate).where(ProductTemplate.id == product_id).with_for_update()
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)

        update_data = request.model_dump(exclude_unset=True)
        if "category_id" in update_data and update_data["category_id"] is not None:
            await self._require_category(update_data["category_id"])
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
            await self._assert_verified_supplier_mapping(product.id, requires_primary_dropship=True)

        for field, value in update_data.items():
            setattr(product, field, value)
        await self.db.flush()
        await self._publish(product)
        return await self.get_product_detail(product.id, include_inactive=True)

    async def delete_product(self, product_id: int) -> None:
        product = await self.db.scalar(
            select(ProductTemplate).where(ProductTemplate.id == product_id).with_for_update()
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        product.is_active = False
        await self.db.flush()
        await self._publish(product)
        logger.info("Product archived: sku=%s id=%s", product.sku, product.id)

    async def add_product_image(
        self,
        product_id: int,
        *,
        url: str,
        alt_text: str | None,
        is_primary: bool,
    ) -> ProductImageResponse:
        product = await self.db.scalar(
            self._base_query(include_inactive=True)
            .where(ProductTemplate.id == product_id)
            .with_for_update()
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)

        existing = self._ordered_images(product)
        make_primary = is_primary or not existing
        if make_primary and existing:
            await self.db.execute(
                update(ProductImage)
                .where(ProductImage.product_id == product_id)
                .values(is_primary=False)
            )
        image = ProductImage(
            product_id=product_id,
            url=url,
            alt_text=(alt_text or product.name)[:255],
            sort_order=(max((item.sort_order for item in existing), default=-1) + 1),
            is_primary=make_primary,
        )
        self.db.add(image)
        await self.db.flush()
        await self._publish(product)
        return ProductImageResponse.model_validate(image)

    async def delete_product_image(self, product_id: int, image_id: int) -> str:
        image = await self.db.scalar(
            select(ProductImage)
            .where(ProductImage.id == image_id, ProductImage.product_id == product_id)
            .with_for_update()
        )
        if image is None:
            raise ResourceNotFoundError("Product image", image_id)
        was_primary = image.is_primary
        url = image.url
        await self.db.delete(image)
        await self.db.flush()
        if was_primary:
            replacement = await self.db.scalar(
                select(ProductImage)
                .where(ProductImage.product_id == product_id)
                .order_by(ProductImage.sort_order, ProductImage.id)
                .limit(1)
            )
            if replacement is not None:
                replacement.is_primary = True
        product = await self.db.get(ProductTemplate, product_id)
        if product is not None:
            await self._publish(product)
        return url

    async def _publish(self, product: ProductTemplate, *, created: bool = False) -> None:
        event_type = ProductCreated if created else ProductUpdated
        await publish_domain_event(
            self.db,
            event_type(payload={"product_id": product.id, "sku": product.sku}),
        )

    async def _require_category(self, category_id: int) -> None:
        exists = await self.db.scalar(
            select(ProductCategory.id).where(ProductCategory.id == category_id)
        )
        if exists is None:
            raise ResourceNotFoundError("Product category", category_id)

    async def _assert_verified_supplier_mapping(
        self, product_id: int, *, requires_primary_dropship: bool
    ) -> None:
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
