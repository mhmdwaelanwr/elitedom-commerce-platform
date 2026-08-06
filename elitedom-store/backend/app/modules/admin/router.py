"""HTTP boundary for the role-protected Elitedom staff administration console."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.schemas import (
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminDashboardResponse,
    AdminOrderDetail,
    AdminOrderListResponse,
    AdminOrderStateUpdateRequest,
    AdminProductListResponse,
    AdminRFQListResponse,
    AdminRMAItem,
    AdminRMAListResponse,
    AdminShipmentListResponse,
    AdminStockAdjustmentRequest,
    AdminStockAdjustmentResponse,
)
from app.modules.admin.service import AdminService
from app.modules.b2b.schemas import B2BRFQResponse, IssueQuoteRequest
from app.modules.b2b.service import B2BService
from app.modules.shipping.service import (
    DispatchOrderRequest,
    DispatchOrderResponse,
    ShippingService,
)
from app.modules.warranty.service import RMAReviewRequest
from app.shared.schemas import OrderState, PaymentStatus, RFQStatus, RMAStatus, UserRole
from app.shared.security import require_role

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]

# A customer JWT can never reach this module. Sub-sections deliberately narrow
# these roles further so support, finance, and warehouse staff see only their
# operational surface.
StaffUser = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.FINANCE_OFFICER,
            UserRole.INVENTORY_MANAGER,
            UserRole.WAREHOUSE_OPERATOR,
            UserRole.CUSTOMER_SUPPORT,
        )
    ),
]
OrderStaff = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.FINANCE_OFFICER,
            UserRole.WAREHOUSE_OPERATOR,
            UserRole.CUSTOMER_SUPPORT,
        )
    ),
]
InventoryStaff = Annotated[
    dict,
    Depends(
        require_role(UserRole.SYSTEM_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_OPERATOR)
    ),
]
InventoryManager = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.INVENTORY_MANAGER)),
]
CustomerStaff = Annotated[
    dict,
    Depends(
        require_role(UserRole.SYSTEM_ADMIN, UserRole.CUSTOMER_SUPPORT, UserRole.FINANCE_OFFICER)
    ),
]
SupportStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.CUSTOMER_SUPPORT)),
]
FinanceStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.FINANCE_OFFICER)),
]
WarehouseStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.WAREHOUSE_OPERATOR)),
]


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_dashboard(
    db: DatabaseSession,
    current_user: StaffUser,
) -> AdminDashboardResponse:
    """Load persisted operational KPIs for an authenticated staff member."""
    return await AdminService(db).dashboard()


@router.get("/orders", response_model=AdminOrderListResponse)
async def list_orders(
    db: DatabaseSession,
    current_user: OrderStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: Annotated[OrderState | None, Query()] = None,
    payment_status: Annotated[PaymentStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminOrderListResponse:
    return await AdminService(db).list_orders(
        page=page, limit=limit, state=state, payment_status=payment_status, query=q
    )


@router.get("/orders/{order_id}", response_model=AdminOrderDetail)
async def get_order(
    order_id: int,
    db: DatabaseSession,
    current_user: OrderStaff,
) -> AdminOrderDetail:
    return await AdminService(db).get_order(order_id)


@router.put("/orders/{order_id}/state", response_model=AdminOrderDetail)
async def update_order_state(
    order_id: int,
    request: AdminOrderStateUpdateRequest,
    db: DatabaseSession,
    current_user: WarehouseStaff,
) -> AdminOrderDetail:
    return await AdminService(db).update_order_state(order_id, request.state)


@router.get("/products", response_model=AdminProductListResponse)
async def list_products(
    db: DatabaseSession,
    current_user: InventoryStaff,
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


@router.post(
    "/products/{product_id}/stock-adjustments",
    response_model=AdminStockAdjustmentResponse,
)
async def adjust_product_stock(
    product_id: int,
    request: AdminStockAdjustmentRequest,
    db: DatabaseSession,
    current_user: InventoryManager,
) -> AdminStockAdjustmentResponse:
    """Record a reasoned local stock correction through the inventory service."""
    return await AdminService(db).adjust_product_stock(product_id, request)


@router.get("/customers", response_model=AdminCustomerListResponse)
async def list_customers(
    db: DatabaseSession,
    current_user: CustomerStaff,
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
    current_user: CustomerStaff,
) -> AdminCustomerDetail:
    return await AdminService(db).get_customer(customer_id)


@router.get("/rma", response_model=AdminRMAListResponse)
async def list_rmas(
    db: DatabaseSession,
    current_user: SupportStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RMAStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRMAListResponse:
    return await AdminService(db).list_rmas(page=page, limit=limit, status=status, query=q)


@router.put("/rma/{ticket_number}/review", response_model=AdminRMAItem)
async def review_rma(
    ticket_number: str,
    request: RMAReviewRequest,
    db: DatabaseSession,
    current_user: SupportStaff,
) -> AdminRMAItem:
    return await AdminService(db).review_rma(ticket_number, current_user["user_id"], request)


@router.get("/rfqs", response_model=AdminRFQListResponse)
async def list_rfqs(
    db: DatabaseSession,
    current_user: FinanceStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RFQStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRFQListResponse:
    return await AdminService(db).list_rfqs(page=page, limit=limit, status=status, query=q)


@router.put("/rfqs/{rfq_code}/quote", response_model=B2BRFQResponse)
async def issue_rfq_quote(
    rfq_code: str,
    request: IssueQuoteRequest,
    db: DatabaseSession,
    current_user: FinanceStaff,
) -> B2BRFQResponse:
    """Reuse the B2B bounded-context service so quote invariants stay intact."""
    return await B2BService(db).issue_quote(rfq_code, request, current_user)


@router.get("/shipments", response_model=AdminShipmentListResponse)
async def list_shipments(
    db: DatabaseSession,
    current_user: WarehouseStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: str | None = Query(default=None, min_length=1, max_length=32),
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminShipmentListResponse:
    return await AdminService(db).list_shipments(page=page, limit=limit, state=state, query=q)


@router.post("/shipments/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    request: DispatchOrderRequest,
    db: DatabaseSession,
    current_user: WarehouseStaff,
) -> DispatchOrderResponse:
    """Dispatch via the fulfilment service; serial assignment rules still apply."""
    return await ShippingService(db).dispatch_order(order_id, request)
