"""Customer loyalty endpoints (FR-LOY-002 and FR-LOY-003)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.loyalty.service import (
    LoyaltyBalanceResponse,
    LoyaltyHistoryResponse,
    LoyaltyRedeemRequest,
    LoyaltyRedemptionResponse,
    LoyaltyService,
)
from app.shared.security import get_current_user

router = APIRouter()


@router.get("/balance", response_model=LoyaltyBalanceResponse)
async def get_loyalty_balance(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the authenticated customer's points balance and EGP value."""
    service = LoyaltyService(db)
    return await service.get_balance(current_user["user_id"])


@router.get("/history", response_model=LoyaltyHistoryResponse)
async def get_loyalty_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get only the authenticated customer's immutable points history."""
    service = LoyaltyService(db)
    return await service.get_history(current_user["user_id"], page=page, limit=limit)


@router.post("/redeem", response_model=LoyaltyRedemptionResponse)
async def redeem_points(
    request: LoyaltyRedeemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Redeem points against a caller-owned unpaid checkout order."""
    service = LoyaltyService(db)
    return await service.redeem_for_order(current_user["user_id"], request)
