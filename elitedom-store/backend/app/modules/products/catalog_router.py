"""Public, locale-aware Stage 8 catalogue API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.products.catalog_schemas import (
    CatalogCategoryResponse,
    CatalogLocale,
    CatalogProductListResponse,
    CatalogProductResponse,
)
from app.modules.products.catalog_service import CatalogContentService

router = APIRouter()


@router.get("/products", response_model=CatalogProductListResponse)
async def list_catalog_products(
    locale: CatalogLocale = Query(default="en"),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    category: str | None = Query(default=None, min_length=1, max_length=128),
    featured: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> CatalogProductListResponse:
    return await CatalogContentService(db).list_public_products(
        locale=locale,
        query=q,
        category_slug=category,
        featured=featured,
        page=page,
        limit=limit,
    )


@router.get("/products/{identifier}", response_model=CatalogProductResponse)
async def get_catalog_product(
    identifier: str,
    locale: CatalogLocale = Query(default="en"),
    db: AsyncSession = Depends(get_db),
) -> CatalogProductResponse:
    return await CatalogContentService(db).get_public_product(identifier, locale=locale)


@router.get("/categories", response_model=list[CatalogCategoryResponse])
async def list_catalog_categories(
    locale: CatalogLocale = Query(default="en"),
    db: AsyncSession = Depends(get_db),
) -> list[CatalogCategoryResponse]:
    return await CatalogContentService(db).list_public_categories(locale=locale)
