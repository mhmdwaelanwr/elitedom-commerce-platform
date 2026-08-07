"""HTTP boundary for the permission-protected staff administration console."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.admin.schemas import (
    AdminAccessResponse,
    AdminAuditListResponse,
    AdminAuditLogItem,
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminDashboardResponse,
    AdminOrderDetail,
    AdminOrderListResponse,
    AdminOrderStateUpdateRequest,
    AdminPermissionCatalogResponse,
    AdminPermissionDefinition,
    AdminProductListResponse,
    AdminRFQListResponse,
    AdminRMAItem,
    AdminRMAListResponse,
    AdminShipmentListResponse,
    AdminStaffAccessItem,
    AdminStaffAccessUpdateRequest,
    AdminStaffListResponse,
    AdminStockAdjustmentRequest,
    AdminStockAdjustmentResponse,
)
from app.modules.admin.service import AdminService
from app.modules.b2b.schemas import B2BRFQResponse, IssueQuoteRequest
from app.modules.b2b.service import B2BService
from app.modules.products.media import delete_product_image_file, store_product_image
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductImageResponse,
    ProductUpdateRequest,
)
from app.modules.products.service import ProductService
from app.modules.shipping.service import (
    DispatchOrderRequest,
    DispatchOrderResponse,
    ShippingService,
)
from app.modules.warranty.service import RMAReviewRequest
from app.shared.exceptions import InsufficientPermissionsError
from app.shared.schemas import OrderState, PaymentStatus, RFQStatus, RMAStatus
from app.shared.security import get_current_user, require_permission

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]

DashboardViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.DASHBOARD_VIEW.value))
]
OrderViewer = Annotated[dict, Depends(require_permission(AdminPermission.ORDERS_VIEW.value))]
OrderManager = Annotated[dict, Depends(require_permission(AdminPermission.ORDERS_MANAGE.value))]
CatalogViewer = Annotated[dict, Depends(require_permission(AdminPermission.CATALOG_VIEW.value))]
CatalogManager = Annotated[dict, Depends(require_permission(AdminPermission.CATALOG_MANAGE.value))]
CatalogArchiver = Annotated[
    dict, Depends(require_permission(AdminPermission.CATALOG_ARCHIVE.value))
]
InventoryViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_VIEW.value))
]
InventoryAdjuster = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_ADJUST.value))
]
CustomerViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.CUSTOMERS_VIEW.value))
]
SupportViewer = Annotated[dict, Depends(require_permission(AdminPermission.SUPPORT_VIEW.value))]
SupportManager = Annotated[
    dict, Depends(require_permission(AdminPermission.SUPPORT_MANAGE.value))
]
RfqViewer = Annotated[dict, Depends(require_permission(AdminPermission.RFQ_VIEW.value))]
RfqQuoter = Annotated[dict, Depends(require_permission(AdminPermission.RFQ_QUOTE.value))]
ShipmentViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.SHIPMENTS_VIEW.value))
]
ShipmentDispatcher = Annotated[
    dict, Depends(require_permission(AdminPermission.SHIPMENTS_DISPATCH.value))
]
StaffViewer = Annotated[dict, Depends(require_permission(AdminPermission.STAFF_VIEW.value))]
StaffManager = Annotated[dict, Depends(require_permission(AdminPermission.STAFF_MANAGE.value))]
AuditViewer = Annotated[dict, Depends(require_permission(AdminPermission.AUDIT_VIEW.value))]


@router.get("/access/me", response_model=AdminAccessResponse)
async def get_my_admin_access(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> AdminAccessResponse:
    role, permissions = await AdminAccessService(db).resolve_permissions(current_user["user_id"])
    if role is None:
        raise InsufficientPermissionsError()
    return AdminAccessResponse(role=role, permissions=sorted(permissions))


@router.get("/access/permissions", response_model=AdminPermissionCatalogResponse)
async def get_permission_catalog(
    db: DatabaseSession,
    current_user: StaffViewer,
) -> AdminPermissionCatalogResponse:
    catalog = await AdminAccessService(db).permission_catalog()
    return AdminPermissionCatalogResponse(
        permissions=[AdminPermissionDefinition(**item) for item in catalog]
    )


@router.get("/staff", response_model=AdminStaffListResponse)
async def list_staff_access(
    db: DatabaseSession,
    current_user: StaffViewer,
) -> AdminStaffListResponse:
    rows = await AdminAccessService(db).list_staff()
    return AdminStaffListResponse(staff=[AdminStaffAccessItem(**row) for row in rows])


@router.put("/staff/{partner_id}/access", response_model=AdminStaffAccessItem)
async def update_staff_access(
    partner_id: int,
    payload: AdminStaffAccessUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: StaffManager,
) -> AdminStaffAccessItem:
    row = await AdminAccessService(db).replace_staff_access(
        target_partner_id=partner_id,
        role=payload.role,
        overrides=[item.model_dump() for item in payload.overrides],
        actor=current_user,
        request=request,
    )
    return AdminStaffAccessItem(**row)


@router.get("/audit-logs", response_model=AdminAuditListResponse)
async def list_admin_audit_logs(
    db: DatabaseSession,
    current_user: AuditViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    action: str | None = Query(default=None, min_length=1, max_length=96),
    entity_type: str | None = Query(default=None, min_length=1, max_length=64),
    actor_partner_id: int | None = Query(default=None, ge=1),
) -> AdminAuditListResponse:
    rows, total = await AdminAccessService(db).list_audit_logs(
        page=page,
        limit=limit,
        action=action,
        entity_type=entity_type,
        actor_partner_id=actor_partner_id,
    )
    return AdminAuditListResponse(
        logs=[AdminAuditLogItem.model_validate(row) for row in rows],
        total_count=total,
        page=page,
        limit=limit,
    )


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_dashboard(
    db: DatabaseSession,
    current_user: DashboardViewer,
) -> AdminDashboardResponse:
    return await AdminService(db).dashboard()


@router.get("/orders", response_model=AdminOrderListResponse)
async def list_orders(
    db: DatabaseSession,
    current_user: OrderViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: Annotated[OrderState | None, Query()] = None,
    payment_status: Annotated[PaymentStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminOrderListResponse:
    return await AdminService(db).list_orders(
        page=page,
        limit=limit,
        state=state,
        payment_status=payment_status,
        query=q,
    )


@router.get("/orders/{order_id}", response_model=AdminOrderDetail)
async def get_order(
    order_id: int,
    db: DatabaseSession,
    current_user: OrderViewer,
) -> AdminOrderDetail:
    return await AdminService(db).get_order(order_id)


@router.put("/orders/{order_id}/state", response_model=AdminOrderDetail)
async def update_order_state(
    order_id: int,
    payload: AdminOrderStateUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: OrderManager,
) -> AdminOrderDetail:
    service = AdminService(db)
    before = await service.get_order(order_id)
    result = await service.update_order_state(order_id, payload.state)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="order.state.update",
        entity_type="order",
        entity_id=order_id,
        before={"state": before.state.value, "payment_status": before.payment_status.value},
        after={"state": result.state.value, "payment_status": result.payment_status.value},
        request=request,
    )
    return result


@router.get("/products", response_model=AdminProductListResponse)
async def list_products(
    db: DatabaseSession,
    current_user: CatalogViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    q: str | None = Query(default=None, min_length=1, max_length=128),
    low_stock: bool = Query(default=False),
    active: bool | None = Query(default=None),
) -> AdminProductListResponse:
    return await AdminService(db).list_products(
        page=page,
        limit=limit,
        query=q,
        low_stock_only=low_stock,
        active=active,
    )


@router.get("/products/categories")
async def list_product_categories(
    db: DatabaseSession,
    current_user: CatalogViewer,
):
    return await ProductService(db).get_category_tree(include_inactive=True)


@router.get("/products/{product_id}", response_model=ProductDetailResponse)
async def get_admin_product(
    product_id: int,
    db: DatabaseSession,
    current_user: CatalogViewer,
) -> ProductDetailResponse:
    return await ProductService(db).get_product_detail(product_id, include_inactive=True)


@router.post("/products", response_model=ProductDetailResponse, status_code=201)
async def create_admin_product(
    payload: ProductCreateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> ProductDetailResponse:
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


@router.put("/products/{product_id}", response_model=ProductDetailResponse)
async def update_admin_product(
    product_id: int,
    payload: ProductUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> ProductDetailResponse:
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


@router.delete("/products/{product_id}", status_code=204)
async def archive_admin_product(
    product_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogArchiver,
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


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=201,
)
async def upload_admin_product_image(
    product_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
    image: UploadFile = File(...),
    alt_text: str | None = Form(default=None, max_length=255),
    is_primary: bool = Form(default=False),
) -> ProductImageResponse:
    product = await ProductService(db).get_product_detail(product_id, include_inactive=True)
    url = await store_product_image(image, product_id)
    try:
        result = await ProductService(db).add_product_image(
            product_id,
            url=url,
            alt_text=alt_text or product.name,
            is_primary=is_primary,
        )
    except Exception:
        delete_product_image_file(url)
        raise
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.image.create",
        entity_type="product",
        entity_id=product_id,
        after=result,
        request=request,
    )
    return result


@router.delete("/products/{product_id}/images/{image_id}", status_code=204)
async def delete_admin_product_image(
    product_id: int,
    image_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
):
    url = await ProductService(db).delete_product_image(product_id, image_id)
    delete_product_image_file(url)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.image.delete",
        entity_type="product_image",
        entity_id=image_id,
        before={"product_id": product_id, "url": url},
        request=request,
    )
    return None


@router.post(
    "/products/{product_id}/stock-adjustments",
    response_model=AdminStockAdjustmentResponse,
)
async def adjust_product_stock(
    product_id: int,
    payload: AdminStockAdjustmentRequest,
    request: Request,
    db: DatabaseSession,
    current_user: InventoryAdjuster,
) -> AdminStockAdjustmentResponse:
    result = await AdminService(db).adjust_product_stock(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="inventory.stock.adjust",
        entity_type="product",
        entity_id=product_id,
        before={"stock_qty": result.previous_stock_qty},
        after={
            "stock_qty": result.stock_qty,
            "quantity_delta": result.quantity_delta,
            "reason": payload.reason,
        },
        request=request,
    )
    return result


@router.get("/customers", response_model=AdminCustomerListResponse)
async def list_customers(
    db: DatabaseSession,
    current_user: CustomerViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    q: str | None = Query(default=None, min_length=1, max_length=128),
    active: bool | None = Query(default=None),
) -> AdminCustomerListResponse:
    return await AdminService(db).list_customers(page=page, limit=limit, query=q, active=active)


@router.get("/customers/{customer_id}", response_model=AdminCustomerDetail)
async def get_customer(
    customer_id: int,
    db: DatabaseSession,
    current_user: CustomerViewer,
) -> AdminCustomerDetail:
    return await AdminService(db).get_customer(customer_id)


@router.get("/rma", response_model=AdminRMAListResponse)
async def list_rmas(
    db: DatabaseSession,
    current_user: SupportViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RMAStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRMAListResponse:
    return await AdminService(db).list_rmas(page=page, limit=limit, status=status, query=q)


@router.put("/rma/{ticket_number}/review", response_model=AdminRMAItem)
async def review_rma(
    ticket_number: str,
    payload: RMAReviewRequest,
    request: Request,
    db: DatabaseSession,
    current_user: SupportManager,
) -> AdminRMAItem:
    result = await AdminService(db).review_rma(ticket_number, current_user["user_id"], payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="support.rma.review",
        entity_type="rma",
        entity_id=ticket_number,
        after=result,
        request=request,
    )
    return result


@router.get("/rfqs", response_model=AdminRFQListResponse)
async def list_rfqs(
    db: DatabaseSession,
    current_user: RfqViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RFQStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRFQListResponse:
    return await AdminService(db).list_rfqs(page=page, limit=limit, status=status, query=q)


@router.put("/rfqs/{rfq_code}/quote", response_model=B2BRFQResponse)
async def issue_rfq_quote(
    rfq_code: str,
    payload: IssueQuoteRequest,
    request: Request,
    db: DatabaseSession,
    current_user: RfqQuoter,
) -> B2BRFQResponse:
    result = await B2BService(db).issue_quote(rfq_code, payload, current_user)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="rfq.quote.issue",
        entity_type="rfq",
        entity_id=rfq_code,
        after=result,
        request=request,
    )
    return result


@router.get("/shipments", response_model=AdminShipmentListResponse)
async def list_shipments(
    db: DatabaseSession,
    current_user: ShipmentViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: str | None = Query(default=None, min_length=1, max_length=32),
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminShipmentListResponse:
    return await AdminService(db).list_shipments(page=page, limit=limit, state=state, query=q)


@router.post("/shipments/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    payload: DispatchOrderRequest,
    request: Request,
    db: DatabaseSession,
    current_user: ShipmentDispatcher,
) -> DispatchOrderResponse:
    result = await ShippingService(db).dispatch_order(order_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="shipment.dispatch",
        entity_type="order",
        entity_id=order_id,
        after=result,
        request=request,
    )
    return result
