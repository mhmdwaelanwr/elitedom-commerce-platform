"""Warranty and RMA HTTP endpoints (FR-RMA-001 to FR-RMA-004)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.warranty.service import (
    RMAListResponse,
    RMAReviewRequest,
    RMASubmitRequest,
    RMASubmitResponse,
    RMATicketResponse,
    WarrantyCheckResponse,
    WarrantyService,
)
from app.shared.schemas import RMAStatus, UserRole
from app.shared.security import get_current_user, require_role

router = APIRouter()


def _can_manage_claims(role: str | None) -> bool:
    return role in {
        UserRole.CUSTOMER_SUPPORT.value,
        UserRole.SYSTEM_ADMIN.value,
    }


def _can_check_any_warranty(role: str | None) -> bool:
    return role in {
        UserRole.CUSTOMER_SUPPORT.value,
        UserRole.WAREHOUSE_OPERATOR.value,
        UserRole.INVENTORY_MANAGER.value,
        UserRole.SYSTEM_ADMIN.value,
    }


@router.post("/claims", response_model=RMASubmitResponse, status_code=201)
async def submit_rma_claim(
    request: RMASubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit a customer-owned RMA claim and run automated eligibility checks."""
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
    """List the caller's claims, or all tickets for support/admin staff."""
    service = WarrantyService(db)
    return await service.list_claims(
        current_user["user_id"],
        include_all=_can_manage_claims(current_user.get("role")),
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
    """Get an RMA ticket, subject to customer ownership or staff RBAC."""
    service = WarrantyService(db)
    return await service.get_claim(
        ticket_number,
        current_user["user_id"],
        include_all=_can_manage_claims(current_user.get("role")),
    )


@router.put("/claims/{ticket_number}/review", response_model=RMATicketResponse)
async def review_rma_claim(
    ticket_number: str,
    request: RMAReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.CUSTOMER_SUPPORT, UserRole.SYSTEM_ADMIN)),
):
    """Approve, reject, or complete an RMA through the support state machine."""
    service = WarrantyService(db)
    return await service.review_claim(ticket_number, current_user["user_id"], request)


@router.get("/check/{serial_number}", response_model=WarrantyCheckResponse)
async def check_warranty(
    serial_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Check a serial's warranty without exposing another customer's asset."""
    service = WarrantyService(db)
    return await service.check_warranty(
        serial_number,
        current_user["user_id"],
        include_all=_can_check_any_warranty(current_user.get("role")),
    )
