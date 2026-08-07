"""Permission-protected administration of Stage 8 catalogue content."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.products.catalog_media import delete_catalog_media_file, store_catalog_media
from app.modules.products.catalog_schemas import (
    CatalogAttributeDefinitionResponse,
    CatalogAttributeDefinitionUpsertRequest,
    CatalogAttributeResponse,
    CatalogCategoryAdminResponse,
    CatalogCategoryUpsertRequest,
    CatalogImageResponse,
    CatalogMediaOrderRequest,
    ProductAttributeReplaceRequest,
    ProductCatalogContentAdminResponse,
    ProductCatalogContentUpdateRequest,
)
from app.modules.products.catalog_service import CatalogContentService
from app.shared.security import require_permission

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CatalogViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.CATALOG_VIEW.value))
]
CatalogManager = Annotated[
    dict, Depends(require_permission(AdminPermission.CATALOG_MANAGE.value))
]


@router.get(
    "/products/{product_id}/content",
    response_model=ProductCatalogContentAdminResponse,
)
async def get_product_content(
    product_id: int,
    db: DatabaseSession,
    current_user: CatalogViewer,
) -> ProductCatalogContentAdminResponse:
    return await CatalogContentService(db).get_admin_product_content(product_id)


@router.put(
    "/products/{product_id}/content",
    response_model=ProductCatalogContentAdminResponse,
)
async def update_product_content(
    product_id: int,
    payload: ProductCatalogContentUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> ProductCatalogContentAdminResponse:
    service = CatalogContentService(db)
    before = await service.get_admin_product_content(product_id)
    result = await service.update_product_content(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.content.update",
        entity_type="product",
        entity_id=product_id,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.get("/categories", response_model=list[CatalogCategoryAdminResponse])
async def list_categories(
    db: DatabaseSession,
    current_user: CatalogViewer,
) -> list[CatalogCategoryAdminResponse]:
    return await CatalogContentService(db).list_admin_categories()


@router.post("/categories", response_model=CatalogCategoryAdminResponse, status_code=201)
async def create_category(
    payload: CatalogCategoryUpsertRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> CatalogCategoryAdminResponse:
    result = await CatalogContentService(db).create_category(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.category.create",
        entity_type="product_category",
        entity_id=result.id,
        after=result,
        request=request,
    )
    return result


@router.put("/categories/{category_id}", response_model=CatalogCategoryAdminResponse)
async def update_category(
    category_id: int,
    payload: CatalogCategoryUpsertRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> CatalogCategoryAdminResponse:
    service = CatalogContentService(db)
    before_rows = await service.list_admin_categories()
    before = next((item for item in before_rows if item.id == category_id), None)
    result = await service.update_category(category_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.category.update",
        entity_type="product_category",
        entity_id=category_id,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.get(
    "/attributes",
    response_model=list[CatalogAttributeDefinitionResponse],
)
async def list_attributes(
    db: DatabaseSession,
    current_user: CatalogViewer,
) -> list[CatalogAttributeDefinitionResponse]:
    return await CatalogContentService(db).list_attribute_definitions()


@router.post(
    "/attributes",
    response_model=CatalogAttributeDefinitionResponse,
    status_code=201,
)
async def create_attribute(
    payload: CatalogAttributeDefinitionUpsertRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> CatalogAttributeDefinitionResponse:
    result = await CatalogContentService(db).create_attribute_definition(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.attribute.create",
        entity_type="product_attribute",
        entity_id=result.id,
        after=result,
        request=request,
    )
    return result


@router.put(
    "/attributes/{attribute_id}",
    response_model=CatalogAttributeDefinitionResponse,
)
async def update_attribute(
    attribute_id: int,
    payload: CatalogAttributeDefinitionUpsertRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> CatalogAttributeDefinitionResponse:
    service = CatalogContentService(db)
    before_rows = await service.list_attribute_definitions()
    before = next((item for item in before_rows if item.id == attribute_id), None)
    result = await service.update_attribute_definition(attribute_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.attribute.update",
        entity_type="product_attribute",
        entity_id=attribute_id,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.put(
    "/products/{product_id}/attributes",
    response_model=list[CatalogAttributeResponse],
)
async def replace_product_attributes(
    product_id: int,
    payload: ProductAttributeReplaceRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> list[CatalogAttributeResponse]:
    result = await CatalogContentService(db).replace_product_attributes(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.attributes.replace",
        entity_type="product",
        entity_id=product_id,
        after={"attributes": result},
        request=request,
    )
    return result


@router.post(
    "/products/{product_id}/media",
    response_model=CatalogImageResponse,
    status_code=201,
)
async def upload_product_media(
    product_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
    image: UploadFile = File(...),
    alt_text: str | None = Form(default=None, max_length=255),
    caption: str | None = Form(default=None, max_length=255),
    caption_ar: str | None = Form(default=None, max_length=255),
    is_primary: bool = Form(default=False),
) -> CatalogImageResponse:
    stored = await store_catalog_media(image, product_id)
    try:
        result = await CatalogContentService(db).add_media(
            product_id,
            stored,
            alt_text=alt_text,
            caption=caption,
            caption_ar=caption_ar,
            is_primary=is_primary,
        )
    except Exception:
        delete_catalog_media_file(stored.url)
        raise
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.media.create",
        entity_type="product_image",
        entity_id=result.id,
        after={
            "product_id": product_id,
            "url": result.url,
            "mime_type": result.mime_type,
            "byte_size": result.byte_size,
            "width": result.width,
            "height": result.height,
            "sha256": result.sha256,
        },
        request=request,
    )
    return result


@router.put(
    "/products/{product_id}/media/order",
    response_model=list[CatalogImageResponse],
)
async def reorder_product_media(
    product_id: int,
    payload: CatalogMediaOrderRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> list[CatalogImageResponse]:
    result = await CatalogContentService(db).reorder_media(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.media.reorder",
        entity_type="product",
        entity_id=product_id,
        after={"images": result},
        request=request,
    )
    return result


@router.delete("/products/{product_id}/media/{image_id}", status_code=204)
async def delete_product_media(
    product_id: int,
    image_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
):
    url = await CatalogContentService(db).delete_media(product_id, image_id)
    delete_catalog_media_file(url)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.media.delete",
        entity_type="product_image",
        entity_id=image_id,
        before={"product_id": product_id, "url": url},
        request=request,
    )
    return None
