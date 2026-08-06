"""Secure supplier, procurement, and goods-receipt HTTP endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.suppliers.dropship import ProductSupplierService
from app.modules.suppliers.schemas import (
    ProductSupplierListResponse,
    ProductSupplierResponse,
    ProductSupplierUpsertRequest,
    PurchaseOrderCreateRequest,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdateRequest,
    SupplierCreateRequest,
    SupplierListResponse,
    SupplierPerformanceResponse,
    SupplierResponse,
    SupplierUpdateRequest,
)
from app.modules.suppliers.service import SupplierService
from app.shared.schemas import UserRole
from app.shared.security import require_role

router = APIRouter()

InventoryUser = Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN))
AdminUser = Depends(require_role(UserRole.SYSTEM_ADMIN))


@router.get("", response_model=SupplierListResponse)
async def list_suppliers(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> SupplierListResponse:
    """List verified suppliers for inventory/procurement staff."""
    return await SupplierService(db).list_suppliers(
        page=page, limit=limit, include_inactive=include_inactive
    )


@router.post("", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    request: SupplierCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = AdminUser,
) -> SupplierResponse:
    """Register a supplier under an administrator-controlled workflow."""
    return await SupplierService(db).create_supplier(request)


@router.get("/purchase-orders", response_model=PurchaseOrderListResponse)
async def list_purchase_orders(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    supplier_id: int | None = Query(default=None, ge=1),
    status: Literal["draft", "sent", "partial", "received", "cancelled"] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> PurchaseOrderListResponse:
    """List procurement records with supplier/status filters."""
    return await SupplierService(db).list_purchase_orders(
        page=page,
        limit=limit,
        supplier_id=supplier_id,
        status=status,
    )


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    request: PurchaseOrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> PurchaseOrderResponse:
    """Create a priced PO using server-side product costs."""
    return await SupplierService(db).create_purchase_order(request)


@router.patch("/purchase-orders/{po_number}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_number: str,
    request: PurchaseOrderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> PurchaseOrderResponse:
    """Advance a PO and receive stock exactly once at the received transition."""
    return await SupplierService(db).update_purchase_order(po_number, request)


@router.get("/products/{product_id}/supplier-links", response_model=ProductSupplierListResponse)
async def list_product_supplier_links(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> ProductSupplierListResponse:
    """Show the configured supplier catalogue links for a product."""
    return await ProductSupplierService(db).list_product_suppliers(product_id)


@router.put(
    "/{supplier_id}/products/{product_id}",
    response_model=ProductSupplierResponse,
)
async def upsert_product_supplier_link(
    supplier_id: int,
    product_id: int,
    request: ProductSupplierUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = AdminUser,
) -> ProductSupplierResponse:
    """Configure a vetted supplier SKU and optionally make it dropship-primary."""
    return await ProductSupplierService(db).upsert_product_supplier(
        supplier_id=supplier_id,
        product_id=product_id,
        request=request,
    )


@router.get("/{supplier_id}/performance", response_model=SupplierPerformanceResponse)
async def get_supplier_performance(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> SupplierPerformanceResponse:
    """Calculate real procurement and delivery performance metrics."""
    return await SupplierService(db).supplier_performance(supplier_id)


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryUser,
) -> SupplierResponse:
    return await SupplierService(db).get_supplier(supplier_id)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    request: SupplierUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = AdminUser,
) -> SupplierResponse:
    """Update or deactivate a supplier without losing its procurement history."""
    return await SupplierService(db).update_supplier(supplier_id, request)
