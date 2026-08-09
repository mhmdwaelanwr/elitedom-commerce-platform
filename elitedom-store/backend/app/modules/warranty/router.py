"""Warranty and RMA HTTP endpoints (FR-RMA-001 to FR-RMA-004)."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.warranty.service import (
    RMAListResponse,
    RMAReviewRequest,
    RMASubmitRequest,
    RMASubmitResponse,
    RMATicketResponse,
    WarrantyCheckResponse,
    WarrantyService,
)
from app.shared.exceptions import InsufficientPermissionsError
from app.shared.schemas import RMAStatus
from app.shared.security import get_current_user, require_permission, require_staff_access

router = APIRouter()


async def _permissions(
    db: AsyncSession,
    current_user: dict,
    *required: AdminPermission,
) -> frozenset[str]:
    try:
        _, permissions = await require_staff_access(
            db=db,
            current_user=current_user,
            permissions=tuple(permission.value for permission in required),
        )
    except InsufficientPermissionsError:
        return frozenset()
    return permissions


@router.post("/claims", response_model=RMASubmitResponse, status_code=201)
async def submit_rma_claim(
    request: RMASubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = WarrantyService(db)
    return await service.submit_claim(current_user["user_id"], request)


@router.get("/claims", response_model=RMAListResponse)
async def list_rma_claims(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: RMAStatus | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    permissions = await _permissions(db, current_user, AdminPermission.SUPPORT_VIEW)
    return await WarrantyService(db).list_claims(
        current_user["user_id"],
        include_all=AdminPermission.SUPPORT_VIEW.value in permissions,
        page=page,
        limit=limit,
        status=status,
    )


@router.get("/claims/{ticket_number}", response_model=RMATicketResponse)
async def get_rma_claim(
    ticket_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    permissions = await _permissions(db, current_user, AdminPermission.SUPPORT_VIEW)
    return await WarrantyService(db).get_claim(
        ticket_number,
        current_user["user_id"],
        include_all=AdminPermission.SUPPORT_VIEW.value in permissions,
    )


@router.put("/claims/{ticket_number}/review", response_model=RMATicketResponse)
async def review_rma_claim(
    ticket_number: str,
    payload: RMAReviewRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(AdminPermission.SUPPORT_MANAGE.value)),
):
    result = await WarrantyService(db).review_claim(ticket_number, current_user["user_id"], payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="support.rma.review",
        entity_type="rma",
        entity_id=ticket_number,
        after=result,
        request=request,
    )
    return result


@router.get("/check/{serial_number}", response_model=WarrantyCheckResponse)
async def check_warranty(
    serial_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    permissions = await _permissions(
        db,
        current_user,
        AdminPermission.SUPPORT_VIEW,
        AdminPermission.INVENTORY_VIEW,
    )
    include_all = bool(
        {
            AdminPermission.SUPPORT_VIEW.value,
            AdminPermission.INVENTORY_VIEW.value,
        }
        & set(permissions)
    )
    return await WarrantyService(db).check_warranty(
        serial_number,
        current_user["user_id"],
        include_all=include_all,
    )
