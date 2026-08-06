"""
Elitedom Store — Products Module Router
CRUD operations and search for the product catalog.
Per FR-CAT-001 to FR-CAT-004 and API_SPECIFICATION.md Section 3.
"""

from typing import Optional

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
    category_id: Optional[int] = Query(None),
    brand: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    in_stock: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch paginated product catalog with filters.
    FR-CAT-001: Multi-level hierarchical category tree.
    """
    service = ProductService(db)
    return await service.list_products(
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
    """
    Typo-tolerant product search via Algolia.
    FR-CAT-002: Real-time search with <300ms response.
    """
    service = ProductService(db)
    return await service.search_products(query=q, page=page, limit=limit)


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Get the full hierarchical category tree."""
    service = ProductService(db)
    return await service.get_category_tree()


@router.get("/{product_id}", response_model=ProductDetailResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed product page data.
    FR-CAT-003: Image galleries, specs, warranty terms, stock status.
    """
    service = ProductService(db)
    return await service.get_product_detail(product_id)


@router.post("", response_model=ProductDetailResponse, status_code=201)
async def create_product(
    request: ProductCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN)),
):
    """
    Create a new product listing (admin only).
    FR-CAT-004: Authorized staff CRUD with Odoo sync.
    """
    service = ProductService(db)
    return await service.create_product(request)


@router.put("/{product_id}", response_model=ProductDetailResponse)
async def update_product(
    product_id: int,
    request: ProductUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN)),
):
    """Update an existing product listing (admin only)."""
    service = ProductService(db)
    return await service.update_product(product_id, request)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.SYSTEM_ADMIN)),
):
    """Soft-delete a product listing (admin only)."""
    service = ProductService(db)
    await service.delete_product(product_id)
    return None
