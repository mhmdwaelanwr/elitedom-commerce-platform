"""Public catalogue and compatibility CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductListResponse,
    ProductUpdateRequest,
)
from app.modules.products.service import ProductService
from app.shared.schemas import UserRole
from app.shared.security import require_role

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
    request: ProductCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN)),
):
    return await ProductService(db).create_product(request)


@router.put("/{product_id}", response_model=ProductDetailResponse)
async def update_product(
    product_id: int,
    request: ProductUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN)),
):
    return await ProductService(db).update_product(product_id, request)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.SYSTEM_ADMIN)),
):
    await ProductService(db).delete_product(product_id)
    return None
