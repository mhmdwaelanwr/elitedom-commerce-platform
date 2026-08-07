"""Public catalogue and permission-protected catalogue mutation routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductListResponse,
    ProductUpdateRequest,
)
from app.modules.products.service import ProductService
from app.shared.security import require_permission

router = APIRouter()


@router.get("", response_model=ProductListResponse)
async def list_products(
    category_id: int | None = Query(None),
    brand: str | None = Query(None),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    in_stock: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).list_products(
        category_id=category_id,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        page=page,
        limit=limit,
    )


@router.get("/search", response_model=ProductListResponse)
async def search_products(
    q: str = Query(..., min_length=1, max_length=200),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).search_products(query=q, page=page, limit=limit)


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    return await ProductService(db).get_category_tree()


@router.get("/{product_id}", response_model=ProductDetailResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    return await ProductService(db).get_product_detail(product_id)


@router.post("", response_model=ProductDetailResponse, status_code=201)
async def create_product(
    payload: ProductCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(AdminPermission.CATALOG_MANAGE.value)),
):
    result = await ProductService(db).create_product(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.create",
        entity_type="product",
        entity_id=result.id,
        after=result,
        request=request,
    )
    return result


@router.put("/{product_id}", response_model=ProductDetailResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(AdminPermission.CATALOG_MANAGE.value)),
):
    service = ProductService(db)
    before = await service.get_product_detail(product_id, include_inactive=True)
    result = await service.update_product(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.update",
        entity_type="product",
        entity_id=product_id,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(AdminPermission.CATALOG_ARCHIVE.value)),
):
    service = ProductService(db)
    before = await service.get_product_detail(product_id, include_inactive=True)
    await service.delete_product(product_id)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.archive",
        entity_type="product",
        entity_id=product_id,
        before=before,
        after={"is_active": False},
        request=request,
    )
    return None
