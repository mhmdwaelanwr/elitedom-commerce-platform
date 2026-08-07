"""Stage 8 catalogue content, publication, attributes, and media service."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Iterable

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductCategory, ProductImage, ProductSupplier, ProductTemplate, Supplier
from app.modules.products.catalog_media import StoredCatalogMedia
from app.modules.products.catalog_models import (
    CategoryCatalogContent,
    ProductAttributeDefinition,
    ProductAttributeValue,
    ProductCatalogContent,
    ProductMediaMetadata,
)
from app.modules.products.catalog_schemas import (
    CatalogAttributeDefinitionResponse,
    CatalogAttributeDefinitionUpsertRequest,
    CatalogAttributeResponse,
    CatalogCategoryAdminResponse,
    CatalogCategoryResponse,
    CatalogCategoryUpsertRequest,
    CatalogImageResponse,
    CatalogLocale,
    CatalogMediaOrderRequest,
    CatalogProductListResponse,
    CatalogProductResponse,
    ProductAttributeReplaceRequest,
    ProductCatalogContentAdminResponse,
    ProductCatalogContentUpdateRequest,
)
from app.shared.events import ProductUpdated
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class CatalogContentService:
    """Content and merchandising around the inventory-safe ProductTemplate SKU master."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_public_products(
        self,
        *,
        locale: CatalogLocale,
        query: str | None = None,
        category_slug: str | None = None,
        featured: bool | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> CatalogProductListResponse:
        filters = [
            ProductTemplate.is_active.is_(True),
            or_(
                ProductCatalogContent.product_id.is_(None),
                ProductCatalogContent.publication_status == "published",
            ),
        ]
        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query}%"
            filters.append(
                or_(
                    ProductTemplate.name.ilike(pattern),
                    ProductTemplate.sku.ilike(pattern),
                    ProductTemplate.brand.ilike(pattern),
                    ProductTemplate.description.ilike(pattern),
                    ProductCatalogContent.name_ar.ilike(pattern),
                    ProductCatalogContent.description_ar.ilike(pattern),
                    ProductCatalogContent.short_description.ilike(pattern),
                    ProductCatalogContent.short_description_ar.ilike(pattern),
                )
            )
        if category_slug:
            filters.append(ProductCategory.slug == category_slug)
        if featured is True:
            filters.append(ProductCatalogContent.is_featured.is_(True))
        elif featured is False:
            filters.append(
                or_(
                    ProductCatalogContent.product_id.is_(None),
                    ProductCatalogContent.is_featured.is_(False),
                )
            )

        count_query = (
            select(func.count())
            .select_from(ProductTemplate)
            .outerjoin(ProductCatalogContent, ProductCatalogContent.product_id == ProductTemplate.id)
            .outerjoin(ProductCategory, ProductTemplate.category_id == ProductCategory.id)
            .where(*filters)
        )
        total = int((await self.db.scalar(count_query)) or 0)
        result = await self.db.execute(
            select(ProductTemplate)
            .outerjoin(ProductCatalogContent, ProductCatalogContent.product_id == ProductTemplate.id)
            .outerjoin(ProductCategory, ProductTemplate.category_id == ProductCategory.id)
            .options(selectinload(ProductTemplate.images), selectinload(ProductTemplate.category))
            .where(*filters)
            .order_by(
                ProductCatalogContent.is_featured.desc(),
                ProductTemplate.updated_at.desc(),
                ProductTemplate.id.desc(),
            )
            .offset((page - 1) * limit)
            .limit(limit)
        )
        products = list(result.scalars().unique())
        return CatalogProductListResponse(
            products=await self._hydrate_products(products, locale=locale),
            total_count=total,
            page=page,
            limit=limit,
        )

    async def get_public_product(
        self,
        identifier: str,
        *,
        locale: CatalogLocale,
    ) -> CatalogProductResponse:
        query = (
            select(ProductTemplate)
            .outerjoin(ProductCatalogContent, ProductCatalogContent.product_id == ProductTemplate.id)
            .options(selectinload(ProductTemplate.images), selectinload(ProductTemplate.category))
            .where(
                ProductTemplate.is_active.is_(True),
                or_(
                    ProductCatalogContent.product_id.is_(None),
                    ProductCatalogContent.publication_status == "published",
                ),
            )
        )
        if identifier.isdigit():
            query = query.where(ProductTemplate.id == int(identifier))
        else:
            slug = self._slugify(identifier)
            if not slug:
                raise ResourceNotFoundError("Product", identifier)
            query = query.where(ProductCatalogContent.slug == slug)
        product = await self.db.scalar(query)
        if product is None:
            raise ResourceNotFoundError("Product", identifier)
        return (await self._hydrate_products([product], locale=locale))[0]

    async def list_public_categories(
        self,
        *,
        locale: CatalogLocale,
    ) -> list[CatalogCategoryResponse]:
        categories = list(
            (
                await self.db.scalars(
                    select(ProductCategory)
                    .where(ProductCategory.is_active.is_(True))
                    .order_by(ProductCategory.sort_order, ProductCategory.name)
                )
            ).all()
        )
        contents = await self._category_content_map(category.id for category in categories)
        nodes = {
            category.id: self._category_response(category, contents.get(category.id), locale=locale)
            for category in categories
        }
        roots: list[CatalogCategoryResponse] = []
        for category in categories:
            node = nodes[category.id]
            parent = nodes.get(category.parent_id or -1)
            if parent is None:
                roots.append(node)
            else:
                parent.children.append(node)
        return roots

    async def get_admin_product_content(self, product_id: int) -> ProductCatalogContentAdminResponse:
        product = await self._require_product(product_id)
        content = await self._ensure_product_content(product)
        return self._product_content_admin_response(product, content)

    async def update_product_content(
        self,
        product_id: int,
        request: ProductCatalogContentUpdateRequest,
    ) -> ProductCatalogContentAdminResponse:
        product = await self.db.scalar(
            select(ProductTemplate).where(ProductTemplate.id == product_id).with_for_update()
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        content = await self._ensure_product_content(product, lock=True)
        values = request.model_dump(exclude_unset=True)

        if "slug" in values and values["slug"] is not None:
            content.slug = await self._unique_slug(values.pop("slug"), product_id=product.id)
        if "name" in values and values["name"] is not None:
            product.name = values.pop("name")
        if "description" in values:
            product.description = values.pop("description")

        target_status = values.get("publication_status")
        if target_status == "published" and content.publication_status != "published":
            await self._assert_publishable(product)
            product.is_active = True
            content.published_at = datetime.now(UTC)
        elif target_status in {"draft", "archived"}:
            product.is_active = False
            if target_status == "draft":
                content.published_at = None

        for field, value in values.items():
            setattr(content, field, value)
        await self.db.flush()
        await self._publish_product_event(product)
        return self._product_content_admin_response(product, content)

    async def list_admin_categories(self) -> list[CatalogCategoryAdminResponse]:
        categories = list(
            (
                await self.db.scalars(
                    select(ProductCategory).order_by(ProductCategory.sort_order, ProductCategory.name)
                )
            ).all()
        )
        contents = await self._category_content_map(category.id for category in categories)
        return [self._category_admin_response(category, contents.get(category.id)) for category in categories]

    async def create_category(
        self,
        request: CatalogCategoryUpsertRequest,
    ) -> CatalogCategoryAdminResponse:
        slug = self._valid_slug(request.slug)
        if await self.db.scalar(select(ProductCategory.id).where(ProductCategory.slug == slug)):
            raise ResourceConflictError(f"Category slug '{slug}' already exists.")
        if request.parent_id is not None:
            await self._require_category(request.parent_id)
        category = ProductCategory(
            name=request.name,
            slug=slug,
            parent_id=request.parent_id,
            description=request.description,
            sort_order=request.sort_order,
            is_active=request.is_active,
        )
        self.db.add(category)
        await self.db.flush()
        content = CategoryCatalogContent(
            category_id=category.id,
            name_ar=request.name_ar,
            description_ar=request.description_ar,
            seo_title=request.seo_title,
            seo_title_ar=request.seo_title_ar,
            seo_description=request.seo_description,
            seo_description_ar=request.seo_description_ar,
            image_url=request.image_url,
            is_featured=request.is_featured,
        )
        self.db.add(content)
        await self.db.flush()
        return self._category_admin_response(category, content)

    async def update_category(
        self,
        category_id: int,
        request: CatalogCategoryUpsertRequest,
    ) -> CatalogCategoryAdminResponse:
        category = await self.db.scalar(
            select(ProductCategory).where(ProductCategory.id == category_id).with_for_update()
        )
        if category is None:
            raise ResourceNotFoundError("Product category", category_id)
        slug = self._valid_slug(request.slug)
        duplicate = await self.db.scalar(
            select(ProductCategory.id).where(
                ProductCategory.slug == slug,
                ProductCategory.id != category_id,
            )
        )
        if duplicate is not None:
            raise ResourceConflictError(f"Category slug '{slug}' already exists.")
        if request.parent_id == category_id:
            raise ResourceConflictError("A category cannot be its own parent.")
        if request.parent_id is not None:
            await self._require_category(request.parent_id)
            if await self._is_descendant(request.parent_id, category_id):
                raise ResourceConflictError("A category cannot be moved below one of its descendants.")

        category.name = request.name
        category.slug = slug
        category.parent_id = request.parent_id
        category.description = request.description
        category.sort_order = request.sort_order
        category.is_active = request.is_active
        content = await self.db.get(CategoryCatalogContent, category_id)
        if content is None:
            content = CategoryCatalogContent(category_id=category_id)
            self.db.add(content)
        content.name_ar = request.name_ar
        content.description_ar = request.description_ar
        content.seo_title = request.seo_title
        content.seo_title_ar = request.seo_title_ar
        content.seo_description = request.seo_description
        content.seo_description_ar = request.seo_description_ar
        content.image_url = request.image_url
        content.is_featured = request.is_featured
        await self.db.flush()
        return self._category_admin_response(category, content)

    async def list_attribute_definitions(self) -> list[CatalogAttributeDefinitionResponse]:
        definitions = list(
            (
                await self.db.scalars(
                    select(ProductAttributeDefinition).order_by(
                        ProductAttributeDefinition.sort_order,
                        ProductAttributeDefinition.name,
                    )
                )
            ).all()
        )
        return [
            CatalogAttributeDefinitionResponse.model_validate(item, from_attributes=True)
            for item in definitions
        ]

    async def create_attribute_definition(
        self,
        request: CatalogAttributeDefinitionUpsertRequest,
    ) -> CatalogAttributeDefinitionResponse:
        if await self.db.scalar(
            select(ProductAttributeDefinition.id).where(ProductAttributeDefinition.code == request.code)
        ):
            raise ResourceConflictError(f"Attribute code '{request.code}' already exists.")
        definition = ProductAttributeDefinition(**request.model_dump())
        self.db.add(definition)
        await self.db.flush()
        return CatalogAttributeDefinitionResponse.model_validate(definition, from_attributes=True)

    async def update_attribute_definition(
        self,
        attribute_id: int,
        request: CatalogAttributeDefinitionUpsertRequest,
    ) -> CatalogAttributeDefinitionResponse:
        definition = await self.db.scalar(
            select(ProductAttributeDefinition)
            .where(ProductAttributeDefinition.id == attribute_id)
            .with_for_update()
        )
        if definition is None:
            raise ResourceNotFoundError("Product attribute", attribute_id)
        duplicate = await self.db.scalar(
            select(ProductAttributeDefinition.id).where(
                ProductAttributeDefinition.code == request.code,
                ProductAttributeDefinition.id != attribute_id,
            )
        )
        if duplicate is not None:
            raise ResourceConflictError(f"Attribute code '{request.code}' already exists.")
        if definition.data_type != request.data_type:
            has_values = await self.db.scalar(
                select(ProductAttributeValue.id)
                .where(ProductAttributeValue.attribute_id == attribute_id)
                .limit(1)
            )
            if has_values is not None:
                raise ResourceConflictError(
                    "Attribute data type cannot change while product values exist."
                )
        for field, value in request.model_dump().items():
            setattr(definition, field, value)
        await self.db.flush()
        return CatalogAttributeDefinitionResponse.model_validate(definition, from_attributes=True)

    async def replace_product_attributes(
        self,
        product_id: int,
        request: ProductAttributeReplaceRequest,
    ) -> list[CatalogAttributeResponse]:
        product = await self._require_product(product_id)
        ids = [item.attribute_id for item in request.attributes]
        definitions = list(
            (
                await self.db.scalars(
                    select(ProductAttributeDefinition).where(
                        ProductAttributeDefinition.id.in_(ids or [-1])
                    )
                )
            ).all()
        )
        definitions_by_id = {item.id: item for item in definitions}
        if set(ids) != set(definitions_by_id):
            raise ResourceNotFoundError("Product attribute", "unknown")
        for item in request.attributes:
            self._validate_attribute_value(definitions_by_id[item.attribute_id], item)

        await self.db.execute(
            delete(ProductAttributeValue).where(ProductAttributeValue.product_id == product_id)
        )
        for item in request.attributes:
            self.db.add(ProductAttributeValue(product_id=product_id, **item.model_dump()))
        await self.db.flush()
        await self._publish_product_event(product)
        attributes = await self._load_attributes([product_id], locale="en")
        return attributes.get(product_id, [])

    async def add_media(
        self,
        product_id: int,
        stored: StoredCatalogMedia,
        *,
        alt_text: str | None,
        caption: str | None,
        caption_ar: str | None,
        is_primary: bool,
    ) -> CatalogImageResponse:
        product = await self._require_product(product_id)
        duplicate = await self.db.scalar(
            select(ProductImage.id)
            .join(ProductMediaMetadata, ProductMediaMetadata.image_id == ProductImage.id)
            .where(
                ProductImage.product_id == product_id,
                ProductMediaMetadata.sha256 == stored.sha256,
            )
            .limit(1)
        )
        if duplicate is not None:
            raise ResourceConflictError("This exact product image is already attached.")
        existing = list(
            (
                await self.db.scalars(
                    select(ProductImage)
                    .where(ProductImage.product_id == product_id)
                    .order_by(ProductImage.sort_order, ProductImage.id)
                )
            ).all()
        )
        make_primary = is_primary or not existing
        if make_primary:
            await self.db.execute(
                update(ProductImage)
                .where(ProductImage.product_id == product_id)
                .values(is_primary=False)
            )
        image = ProductImage(
            product_id=product_id,
            url=stored.url,
            alt_text=(alt_text or product.name)[:255],
            sort_order=max((item.sort_order for item in existing), default=-1) + 1,
            is_primary=make_primary,
        )
        self.db.add(image)
        await self.db.flush()
        metadata = ProductMediaMetadata(
            image_id=image.id,
            caption=caption,
            caption_ar=caption_ar,
            mime_type=stored.mime_type,
            byte_size=stored.byte_size,
            width=stored.width,
            height=stored.height,
            sha256=stored.sha256,
            storage_provider=stored.storage_provider,
        )
        self.db.add(metadata)
        await self.db.flush()
        await self._publish_product_event(product)
        return self._image_response(image, metadata, locale="en")

    async def reorder_media(
        self,
        product_id: int,
        request: CatalogMediaOrderRequest,
    ) -> list[CatalogImageResponse]:
        product = await self._require_product(product_id)
        images = list(
            (
                await self.db.scalars(
                    select(ProductImage)
                    .where(ProductImage.product_id == product_id)
                    .with_for_update()
                )
            ).all()
        )
        images_by_id = {item.id: item for item in images}
        if {item.image_id for item in request.images} != set(images_by_id):
            raise ResourceConflictError(
                "Media ordering must include every image attached to the product."
            )
        metadata_by_id = await self._media_metadata_map(images_by_id)
        for item in request.images:
            image = images_by_id[item.image_id]
            image.sort_order = item.sort_order
            image.is_primary = item.is_primary
            image.alt_text = item.alt_text
            metadata = metadata_by_id.get(image.id)
            if metadata is None:
                metadata = ProductMediaMetadata(
                    image_id=image.id,
                    storage_provider="local" if image.url.startswith("/media/") else "external",
                )
                self.db.add(metadata)
                metadata_by_id[image.id] = metadata
            metadata.caption = item.caption
            metadata.caption_ar = item.caption_ar
        await self.db.flush()
        await self._publish_product_event(product)
        return [
            self._image_response(image, metadata_by_id.get(image.id), locale="en")
            for image in sorted(images, key=lambda item: (item.sort_order, item.id))
        ]

    async def delete_media(self, product_id: int, image_id: int) -> str:
        product = await self._require_product(product_id)
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
        await self._publish_product_event(product)
        return url

    async def _hydrate_products(
        self,
        products: list[ProductTemplate],
        *,
        locale: CatalogLocale,
    ) -> list[CatalogProductResponse]:
        if not products:
            return []
        product_ids = [product.id for product in products]
        content_rows = list(
            (
                await self.db.scalars(
                    select(ProductCatalogContent).where(
                        ProductCatalogContent.product_id.in_(product_ids)
                    )
                )
            ).all()
        )
        contents = {item.product_id: item for item in content_rows}
        category_ids = [
            product.category_id for product in products if product.category_id is not None
        ]
        category_contents = await self._category_content_map(category_ids)
        attributes = await self._load_attributes(product_ids, locale=locale)
        image_ids = [image.id for product in products for image in product.images]
        media = await self._media_metadata_map(image_ids)

        result: list[CatalogProductResponse] = []
        for product in products:
            content = contents.get(product.id)
            name = self._localized(content.name_ar if content else None, product.name, locale) or product.name
            description = self._localized(
                content.description_ar if content else None,
                product.description,
                locale,
            )
            short_description = self._localized(
                content.short_description_ar if content else None,
                content.short_description if content else None,
                locale,
            )
            category = None
            if product.category is not None:
                category = self._category_response(
                    product.category,
                    category_contents.get(product.category.id),
                    locale=locale,
                )
            images = [
                self._image_response(image, media.get(image.id), locale=locale)
                for image in sorted(
                    product.images,
                    key=lambda item: (not item.is_primary, item.sort_order, item.id),
                )
            ]
            seo_title = self._localized(
                content.seo_title_ar if content else None,
                content.seo_title if content else None,
                locale,
            ) or name
            seo_description = self._localized(
                content.seo_description_ar if content else None,
                content.seo_description if content else None,
                locale,
            ) or short_description or description
            result.append(
                CatalogProductResponse(
                    id=product.id,
                    slug=content.slug if content else self._slugify(product.sku),
                    sku=product.sku,
                    name=name,
                    short_description=short_description,
                    description=description,
                    brand=product.brand,
                    list_price=product.list_price,
                    stock_qty=product.stock_qty,
                    is_dropship_enabled=product.is_dropship_enabled,
                    warranty_months=product.warranty_months,
                    category=category,
                    is_featured=bool(content and content.is_featured),
                    images=images,
                    attributes=attributes.get(product.id, []),
                    seo_title=seo_title,
                    seo_description=seo_description,
                    published_at=content.published_at if content else product.created_at,
                )
            )
        return result

    async def _load_attributes(
        self,
        product_ids: Iterable[int],
        *,
        locale: CatalogLocale,
    ) -> dict[int, list[CatalogAttributeResponse]]:
        ids = list(product_ids)
        rows = (
            await self.db.execute(
                select(ProductAttributeValue, ProductAttributeDefinition)
                .join(
                    ProductAttributeDefinition,
                    ProductAttributeDefinition.id == ProductAttributeValue.attribute_id,
                )
                .where(
                    ProductAttributeValue.product_id.in_(ids or [-1]),
                    ProductAttributeDefinition.is_active.is_(True),
                )
                .order_by(
                    ProductAttributeValue.product_id,
                    ProductAttributeValue.sort_order,
                    ProductAttributeDefinition.sort_order,
                    ProductAttributeDefinition.name,
                )
            )
        ).all()
        result: dict[int, list[CatalogAttributeResponse]] = {product_id: [] for product_id in ids}
        for value, definition in rows:
            result.setdefault(value.product_id, []).append(
                CatalogAttributeResponse(
                    definition_id=definition.id,
                    code=definition.code,
                    label=self._localized(definition.name_ar, definition.name, locale) or definition.name,
                    data_type=definition.data_type,
                    value=self._render_attribute_value(value, definition, locale),
                    unit=self._localized(definition.unit_ar, definition.unit, locale),
                    is_filterable=definition.is_filterable,
                    sort_order=value.sort_order,
                )
            )
        return result

    async def _category_content_map(
        self,
        category_ids: Iterable[int],
    ) -> dict[int, CategoryCatalogContent]:
        ids = list({int(category_id) for category_id in category_ids})
        if not ids:
            return {}
        rows = list(
            (
                await self.db.scalars(
                    select(CategoryCatalogContent).where(
                        CategoryCatalogContent.category_id.in_(ids)
                    )
                )
            ).all()
        )
        return {item.category_id: item for item in rows}

    async def _media_metadata_map(
        self,
        image_ids: Iterable[int],
    ) -> dict[int, ProductMediaMetadata]:
        ids = list({int(image_id) for image_id in image_ids})
        if not ids:
            return {}
        rows = list(
            (
                await self.db.scalars(
                    select(ProductMediaMetadata).where(ProductMediaMetadata.image_id.in_(ids))
                )
            ).all()
        )
        return {item.image_id: item for item in rows}

    def _product_content_admin_response(
        self,
        product: ProductTemplate,
        content: ProductCatalogContent,
    ) -> ProductCatalogContentAdminResponse:
        return ProductCatalogContentAdminResponse(
            product_id=product.id,
            slug=content.slug,
            name=product.name,
            name_ar=content.name_ar,
            short_description=content.short_description,
            short_description_ar=content.short_description_ar,
            description=product.description,
            description_ar=content.description_ar,
            seo_title=content.seo_title,
            seo_title_ar=content.seo_title_ar,
            seo_description=content.seo_description,
            seo_description_ar=content.seo_description_ar,
            publication_status=content.publication_status,
            is_featured=content.is_featured,
            published_at=content.published_at,
        )

    def _category_response(
        self,
        category: ProductCategory,
        content: CategoryCatalogContent | None,
        *,
        locale: CatalogLocale,
    ) -> CatalogCategoryResponse:
        return CatalogCategoryResponse(
            id=category.id,
            slug=category.slug,
            name=self._localized(content.name_ar if content else None, category.name, locale)
            or category.name,
            description=self._localized(
                content.description_ar if content else None,
                category.description,
                locale,
            ),
            image_url=content.image_url if content else None,
            is_featured=bool(content and content.is_featured),
        )

    @staticmethod
    def _category_admin_response(
        category: ProductCategory,
        content: CategoryCatalogContent | None,
    ) -> CatalogCategoryAdminResponse:
        return CatalogCategoryAdminResponse(
            id=category.id,
            name=category.name,
            name_ar=content.name_ar if content else None,
            slug=category.slug,
            parent_id=category.parent_id,
            description=category.description,
            description_ar=content.description_ar if content else None,
            seo_title=content.seo_title if content else None,
            seo_title_ar=content.seo_title_ar if content else None,
            seo_description=content.seo_description if content else None,
            seo_description_ar=content.seo_description_ar if content else None,
            image_url=content.image_url if content else None,
            is_featured=bool(content and content.is_featured),
            sort_order=category.sort_order,
            is_active=category.is_active,
        )

    def _image_response(
        self,
        image: ProductImage,
        metadata: ProductMediaMetadata | None,
        *,
        locale: CatalogLocale,
    ) -> CatalogImageResponse:
        return CatalogImageResponse(
            id=image.id,
            url=image.url,
            alt_text=image.alt_text,
            caption=self._localized(
                metadata.caption_ar if metadata else None,
                metadata.caption if metadata else None,
                locale,
            ),
            sort_order=image.sort_order,
            is_primary=image.is_primary,
            mime_type=metadata.mime_type if metadata else None,
            byte_size=metadata.byte_size if metadata else None,
            width=metadata.width if metadata else None,
            height=metadata.height if metadata else None,
            sha256=metadata.sha256 if metadata else None,
            storage_provider=(
                metadata.storage_provider
                if metadata
                else ("local" if image.url.startswith("/media/") else "external")
            ),
        )

    async def _ensure_product_content(
        self,
        product: ProductTemplate,
        *,
        lock: bool = False,
    ) -> ProductCatalogContent:
        query = select(ProductCatalogContent).where(ProductCatalogContent.product_id == product.id)
        if lock:
            query = query.with_for_update()
        content = await self.db.scalar(query)
        if content is not None:
            return content
        content = ProductCatalogContent(
            product_id=product.id,
            slug=await self._unique_slug(product.sku, product_id=product.id),
            publication_status="published" if product.is_active else "draft",
            published_at=product.created_at if product.is_active else None,
        )
        self.db.add(content)
        await self.db.flush()
        return content

    async def _unique_slug(self, value: str, *, product_id: int) -> str:
        base = self._slugify(value) or f"product-{product_id}"
        candidate = base
        suffix = 2
        while True:
            existing = await self.db.scalar(
                select(ProductCatalogContent.product_id).where(
                    ProductCatalogContent.slug == candidate,
                    ProductCatalogContent.product_id != product_id,
                )
            )
            if existing is None:
                return candidate
            candidate = f"{base}-{suffix}"
            suffix += 1

    async def _require_product(self, product_id: int) -> ProductTemplate:
        product = await self.db.get(ProductTemplate, product_id)
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        return product

    async def _require_category(self, category_id: int) -> ProductCategory:
        category = await self.db.get(ProductCategory, category_id)
        if category is None:
            raise ResourceNotFoundError("Product category", category_id)
        return category

    async def _is_descendant(self, candidate_parent_id: int, category_id: int) -> bool:
        cursor = await self.db.get(ProductCategory, candidate_parent_id)
        visited: set[int] = set()
        while cursor is not None and cursor.id not in visited:
            if cursor.id == category_id:
                return True
            visited.add(cursor.id)
            cursor = (
                await self.db.get(ProductCategory, cursor.parent_id)
                if cursor.parent_id is not None
                else None
            )
        return False

    async def _assert_publishable(self, product: ProductTemplate) -> None:
        if product.category_id is None:
            raise ResourceConflictError("A product needs a category before it can be published.")
        image_id = await self.db.scalar(
            select(ProductImage.id).where(ProductImage.product_id == product.id).limit(1)
        )
        if image_id is None:
            raise ResourceConflictError("A product needs at least one image before it can be published.")
        conditions = [
            ProductSupplier.product_id == product.id,
            ProductSupplier.is_active.is_(True),
            Supplier.is_active.is_(True),
            Supplier.is_verified.is_(True),
        ]
        if product.is_dropship_enabled:
            conditions.append(ProductSupplier.is_primary.is_(True))
        supplier_link = await self.db.scalar(
            select(ProductSupplier.id)
            .join(Supplier, Supplier.id == ProductSupplier.supplier_id)
            .where(*conditions)
            .limit(1)
        )
        if supplier_link is None:
            requirement = (
                "a verified primary dropship supplier"
                if product.is_dropship_enabled
                else "a verified supplier"
            )
            raise ResourceConflictError(f"A product needs {requirement} before it can be published.")

    @staticmethod
    def _validate_attribute_value(definition, item) -> None:
        supplied = {
            "text": item.value_text is not None,
            "number": item.value_number is not None,
            "boolean": item.value_boolean is not None,
        }
        if not supplied[definition.data_type]:
            raise ResourceConflictError(
                f"Attribute '{definition.code}' requires a {definition.data_type} value."
            )

    @staticmethod
    def _render_attribute_value(
        value: ProductAttributeValue,
        definition: ProductAttributeDefinition,
        locale: CatalogLocale,
    ) -> str:
        if definition.data_type == "boolean":
            if locale == "ar":
                return "نعم" if value.value_boolean else "لا"
            return "Yes" if value.value_boolean else "No"
        if definition.data_type == "number":
            number = value.value_number or Decimal("0")
            return format(number.normalize(), "f")
        return CatalogContentService._localized(value.value_text_ar, value.value_text, locale) or ""

    @staticmethod
    def _localized(arabic: str | None, english: str | None, locale: CatalogLocale) -> str | None:
        if locale == "ar" and arabic and arabic.strip():
            return arabic
        return english

    @staticmethod
    def _slugify(value: str) -> str:
        return _SLUG_RE.sub("-", value.strip().lower()).strip("-")[:180]

    def _valid_slug(self, value: str) -> str:
        slug = self._slugify(value)
        if len(slug) < 2:
            raise ResourceConflictError(
                "Catalogue slugs must include at least two Latin letters or digits."
            )
        return slug

    async def _publish_product_event(self, product: ProductTemplate) -> None:
        await publish_domain_event(
            self.db,
            ProductUpdated(payload={"product_id": product.id, "sku": product.sku}),
        )
