"""Loyalty ledger, balance, history, and order-bound redemption services."""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LoyaltyLedger, Partner, SaleOrder
from app.shared.events import LoyaltyPointsEarned, LoyaltyPointsRedeemed
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event
from app.shared.schemas import LoyaltyTransactionType, OrderState, PaymentStatus

# FR-LOY-001: earn one point per EGP 10 spent.
EARN_RATE_EGP = Decimal("10.00")
# FR-LOY-003: twenty points are worth one EGP.
REDEEM_RATE_POINTS = 20
REDEEM_RATE_EGP = Decimal("1.00")
VAT_RATE = Decimal("0.14")
MONEY_PRECISION = Decimal("0.01")


class LoyaltyBalanceResponse(BaseModel):
    points_balance: int
    redeemable_value_egp: Decimal


class LoyaltyTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    points_delta: int
    transaction_type: LoyaltyTransactionType
    reference_order_id: int | None = None
    description: str | None = None
    created_at: datetime


class LoyaltyHistoryResponse(BaseModel):
    transactions: list[LoyaltyTransactionResponse]
    total_count: int
    page: int
    limit: int


class LoyaltyRedeemRequest(BaseModel):
    """Redeem points against a customer-owned, unpaid checkout order."""

    order_id: int = Field(..., ge=1)
    points_to_redeem: int = Field(..., ge=REDEEM_RATE_POINTS, le=1_000_000)

    @field_validator("points_to_redeem")
    @classmethod
    def validate_point_increment(cls, value: int) -> int:
        if value % REDEEM_RATE_POINTS != 0:
            raise ValueError(f"points_to_redeem must be a multiple of {REDEEM_RATE_POINTS}.")
        return value


class LoyaltyRedemptionResponse(BaseModel):
    status: str = "redeemed"
    order_id: int
    points_used: int
    discount_applied: Decimal
    remaining_points_balance: int
    order_total_egp: Decimal


class LoyaltyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_balance(self, partner_id: int) -> LoyaltyBalanceResponse:
        """Calculate a customer's current balance from the immutable ledger."""
        await self._get_active_partner(partner_id)
        res = await self.db.execute(
            select(func.coalesce(func.sum(LoyaltyLedger.points_delta), 0)).where(
                LoyaltyLedger.partner_id == partner_id
            )
        )
        total_points = int(res.scalar_one())
        available_points = max(total_points, 0)
        value_egp = (Decimal(available_points) / Decimal(REDEEM_RATE_POINTS)) * REDEEM_RATE_EGP
        return LoyaltyBalanceResponse(
            points_balance=available_points,
            redeemable_value_egp=value_egp.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP),
        )

    async def get_history(
        self, partner_id: int, *, page: int, limit: int
    ) -> LoyaltyHistoryResponse:
        """Return a paginated, newest-first view of the caller's own ledger."""
        await self._get_active_partner(partner_id)
        count_result = await self.db.execute(
            select(func.count())
            .select_from(LoyaltyLedger)
            .where(LoyaltyLedger.partner_id == partner_id)
        )
        total_count = count_result.scalar_one()
        result = await self.db.execute(
            select(LoyaltyLedger)
            .where(LoyaltyLedger.partner_id == partner_id)
            .order_by(LoyaltyLedger.created_at.desc(), LoyaltyLedger.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        entries = result.scalars().all()
        return LoyaltyHistoryResponse(
            transactions=[LoyaltyTransactionResponse.model_validate(entry) for entry in entries],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def earn_points_for_order(
        self, partner_id: int, order_id: int, order_total_egp: Decimal
    ) -> int:
        """Award points once for a completed, paid order (FR-LOY-001)."""
        await self._get_active_partner(partner_id)
        order = await self._get_owned_order(partner_id, order_id)
        if order.state != OrderState.DONE.value or order.payment_status != PaymentStatus.PAID.value:
            raise ResourceConflictError(
                "Loyalty points can only be earned for completed, paid orders."
            )

        previous_award = await self.db.execute(
            select(LoyaltyLedger.id).where(
                LoyaltyLedger.partner_id == partner_id,
                LoyaltyLedger.reference_order_id == order_id,
                LoyaltyLedger.transaction_type == LoyaltyTransactionType.PURCHASE_EARN.value,
            )
        )
        if previous_award.scalar_one_or_none() is not None:
            return 0

        points_earned = int(order_total_egp // EARN_RATE_EGP)
        if points_earned <= 0:
            return 0

        entry = LoyaltyLedger(
            partner_id=partner_id,
            points_delta=points_earned,
            transaction_type=LoyaltyTransactionType.PURCHASE_EARN.value,
            reference_order_id=order_id,
            description=f"Points earned from order {order.name}",
        )
        self.db.add(entry)
        await self.db.flush()

        await publish_domain_event(
            self.db,
            LoyaltyPointsEarned(payload={"partner_id": partner_id, "points": points_earned}),
        )
        return points_earned

    async def redeem_for_order(
        self, partner_id: int, request: LoyaltyRedeemRequest
    ) -> LoyaltyRedemptionResponse:
        """
        Apply a one-time loyalty discount to an unpaid draft/sent order.

        Locking the partner row serializes concurrent redemption requests for a
        customer. The ledger is append-only; the order total records the actual
        checkout discount so points can never be spent without an order benefit.
        """
        self._validate_redemption_points(request.points_to_redeem)
        await self._get_active_partner(partner_id, lock_for_update=True)
        order = await self._get_owned_order(partner_id, request.order_id)
        # Stripe calculates its signed amount from the checkout session.  A
        # discount applied after either identifier exists would make the local
        # total diverge from the amount that Stripe can later confirm.
        if order.stripe_session_id or order.stripe_payment_intent_id:
            raise ResourceConflictError(
                "Loyalty points cannot be redeemed after Stripe checkout has been initialized."
            )
        if order.state not in {OrderState.DRAFT.value, OrderState.SENT.value}:
            raise ResourceConflictError(
                "Loyalty points can only be redeemed before order confirmation."
            )
        if order.payment_status != PaymentStatus.PENDING.value:
            raise ResourceConflictError(
                "Loyalty points cannot be redeemed after payment processing."
            )

        prior_redemption = await self.db.execute(
            select(LoyaltyLedger.id).where(
                LoyaltyLedger.partner_id == partner_id,
                LoyaltyLedger.reference_order_id == order.id,
                LoyaltyLedger.transaction_type == LoyaltyTransactionType.ORDER_REDEMPTION.value,
            )
        )
        if prior_redemption.scalar_one_or_none() is not None:
            raise ResourceConflictError("Loyalty points have already been redeemed for this order.")

        balance = await self.get_balance(partner_id)
        if balance.points_balance < request.points_to_redeem:
            raise ResourceConflictError("Insufficient loyalty points balance.")

        discount_egp = self._points_to_discount(request.points_to_redeem)
        if discount_egp > order.amount_subtotal:
            raise ResourceConflictError(
                "Loyalty discount cannot exceed the order merchandise subtotal."
            )

        order.amount_subtotal = (order.amount_subtotal - discount_egp).quantize(
            MONEY_PRECISION, rounding=ROUND_HALF_UP
        )
        order.amount_tax = ((order.amount_subtotal + order.amount_shipping) * VAT_RATE).quantize(
            MONEY_PRECISION, rounding=ROUND_HALF_UP
        )
        order.amount_total = (
            order.amount_subtotal + order.amount_shipping + order.amount_tax
        ).quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)

        entry = LoyaltyLedger(
            partner_id=partner_id,
            points_delta=-request.points_to_redeem,
            transaction_type=LoyaltyTransactionType.ORDER_REDEMPTION.value,
            reference_order_id=order.id,
            description=(f"Points redeemed for EGP {discount_egp} discount on order {order.name}"),
        )
        self.db.add(entry)
        await self.db.flush()

        await publish_domain_event(
            self.db,
            LoyaltyPointsRedeemed(
                payload={
                    "partner_id": partner_id,
                    "points": request.points_to_redeem,
                    "order_id": order.id,
                }
            ),
        )
        return LoyaltyRedemptionResponse(
            order_id=order.id,
            points_used=request.points_to_redeem,
            discount_applied=discount_egp,
            remaining_points_balance=balance.points_balance - request.points_to_redeem,
            order_total_egp=order.amount_total,
        )

    async def redeem_points(
        self,
        partner_id: int,
        points_to_redeem: int,
        order_id: int | None = None,
    ) -> Decimal:
        """
        Backwards-compatible service API for internal callers.

        HTTP callers use :meth:`redeem_for_order`, which always binds points to
        an unpaid order.  Keeping this narrow wrapper avoids breaking existing
        background integrations while preserving the previous Decimal return
        contract.  New callers should always provide ``order_id``.
        """
        self._validate_redemption_points(points_to_redeem)
        if order_id is not None:
            result = await self.redeem_for_order(
                partner_id,
                LoyaltyRedeemRequest(
                    order_id=order_id,
                    points_to_redeem=points_to_redeem,
                ),
            )
            return result.discount_applied

        # This path is intentionally unavailable through the public router.
        # It supports pre-existing internal voucher workflows that did not yet
        # persist an order reference, while retaining ledger and balance checks.
        await self._get_active_partner(partner_id, lock_for_update=True)
        balance = await self.get_balance(partner_id)
        if balance.points_balance < points_to_redeem:
            raise ResourceConflictError("Insufficient loyalty points balance.")

        discount_egp = self._points_to_discount(points_to_redeem)
        entry = LoyaltyLedger(
            partner_id=partner_id,
            points_delta=-points_to_redeem,
            transaction_type=LoyaltyTransactionType.ORDER_REDEMPTION.value,
            description=f"Points redeemed for EGP {discount_egp} discount",
        )
        self.db.add(entry)
        await self.db.flush()
        await publish_domain_event(
            self.db,
            LoyaltyPointsRedeemed(payload={"partner_id": partner_id, "points": points_to_redeem}),
        )
        return discount_egp

    async def _get_active_partner(
        self, partner_id: int, *, lock_for_update: bool = False
    ) -> Partner:
        query = select(Partner).where(
            Partner.id == partner_id,
            Partner.is_active.is_(True),
        )
        if lock_for_update:
            query = query.with_for_update()
        result = await self.db.execute(query)
        partner = result.scalar_one_or_none()
        if not partner:
            raise ResourceNotFoundError("Partner", partner_id)
        return partner

    async def _get_owned_order(self, partner_id: int, order_id: int) -> SaleOrder:
        result = await self.db.execute(
            select(SaleOrder).where(
                SaleOrder.id == order_id,
                SaleOrder.partner_id == partner_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)
        return order

    @staticmethod
    def _validate_redemption_points(points_to_redeem: int) -> None:
        if (
            not isinstance(points_to_redeem, int)
            or isinstance(points_to_redeem, bool)
            or points_to_redeem < REDEEM_RATE_POINTS
            or points_to_redeem % REDEEM_RATE_POINTS != 0
        ):
            raise ResourceConflictError(
                f"Loyalty redemption must be a multiple of {REDEEM_RATE_POINTS} points."
            )

    @staticmethod
    def _points_to_discount(points_to_redeem: int) -> Decimal:
        return (
            (Decimal(points_to_redeem) / Decimal(REDEEM_RATE_POINTS)) * REDEEM_RATE_EGP
        ).quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)
