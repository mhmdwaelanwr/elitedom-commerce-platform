"""
Elitedom Store — Orders & Cart Module Service
Shopping cart management, checkout orchestration, and order state machine.
Per FR-CART-001 to FR-ORD-004.
"""

import logging
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.paymob.client import (
    PaymobClient,
    ensure_paymob_is_configured,
    to_minor_units,
)
from app.models import (
    Cart,
    CartItem,
    Partner,
    ProductTemplate,
    SaleOrder,
    SaleOrderLine,
)
from app.modules.orders.schemas import (
    AddToCartRequest,
    CartItemSchema,
    CartSchema,
    CheckoutRequest,
    CheckoutResponse,
    SaleOrderResponse,
    UpdateCartItemRequest,
)
from app.modules.payments.models import PaymentAttempt
from app.shared.events import CartCheckedOut, OrderConfirmed, OrderCreated
from app.shared.exceptions import (
    InsufficientStockError,
    InvalidOrderStateTransition,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, PaymentMethod

logger = logging.getLogger(__name__)

# Governorate shipping rates (EGP) per FR-CART-004
GOVERNORATE_SHIPPING_RATES: dict[str, Decimal] = {
    "Cairo": Decimal("150.00"),
    "Giza": Decimal("50.00"),
    "Alexandria": Decimal("75.00"),
    "Qalyubia": Decimal("60.00"),
    "Dakahlia": Decimal("80.00"),
    "Sharqia": Decimal("80.00"),
    "Red Sea": Decimal("150.00"),
    "Aswan": Decimal("150.00"),
    "Luxor": Decimal("120.00"),
}
DEFAULT_SHIPPING_RATE = Decimal("100.00")
MONEY_QUANTUM = Decimal("0.01")
ELECTRONIC_PAYMENT_METHODS = {
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.MOBILE_WALLET,
}

# Order State Machine valid transitions per FR-ORD-002
VALID_STATE_TRANSITIONS: dict[OrderState, set[OrderState]] = {
    OrderState.DRAFT: {OrderState.SENT, OrderState.SALE, OrderState.CANCEL},
    OrderState.SENT: {OrderState.SALE, OrderState.CANCEL},
    OrderState.SALE: {OrderState.DONE, OrderState.CANCEL},
    OrderState.DONE: set(),
    OrderState.CANCEL: set(),
}


class OrderService:
    """Shopping cart, checkout orchestration, and order lifecycle management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Cart Management ──────────────────────────────────────────────────────

    async def get_cart(
        self, partner_id: Optional[int] = None, session_id: Optional[str] = None
    ) -> CartSchema:
        """Get or create the cart owned by one authenticated user or guest session."""
        self._require_cart_owner(partner_id=partner_id, session_id=session_id)
        cart = await self._find_cart(partner_id, session_id)
        if not cart:
            cart = Cart(
                partner_id=partner_id,
                session_id=session_id if partner_id is None else None,
                is_active=True,
            )
            self.db.add(cart)
            await self.db.flush()
            cart = await self._load_cart(cart.id)

        products_by_id = await self._products_by_id(cart.items)
        items_schema = []
        subtotal = Decimal("0.00")
        for item in cart.items:
            prod = products_by_id.get(item.product_id)
            line_total = (prod.list_price * item.quantity) if prod else Decimal("0.00")
            subtotal += line_total
            items_schema.append(
                CartItemSchema(
                    id=item.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    product_name=prod.name if prod else None,
                    unit_price=prod.list_price if prod else None,
                    line_total=line_total if prod else None,
                    sku=prod.sku if prod else None,
                )
            )

        return CartSchema(
            id=cart.id,
            partner_id=cart.partner_id,
            session_id=cart.session_id,
            items=items_schema,
            subtotal=subtotal,
            item_count=sum(item.quantity for item in cart.items),
        )

    async def add_to_cart(
        self,
        request: AddToCartRequest,
        partner_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> CartSchema:
        """Add product to shopping cart with stock check."""
        self._require_cart_owner(partner_id=partner_id, session_id=session_id)

        prod_res = await self.db.execute(
            select(ProductTemplate).where(ProductTemplate.id == request.product_id)
        )
        product = prod_res.scalar_one_or_none()
        if not product or not product.is_active:
            raise ResourceNotFoundError("Product", request.product_id)

        if product.stock_qty < request.quantity and not product.is_dropship_enabled:
            raise InsufficientStockError(product.sku, request.quantity, product.stock_qty)

        cart = await self._find_cart(partner_id, session_id)
        if not cart:
            cart = Cart(
                partner_id=partner_id,
                session_id=session_id if partner_id is None else None,
                is_active=True,
            )
            self.db.add(cart)
            await self.db.flush()
            cart = await self._load_cart(cart.id)

        existing_item = next((i for i in cart.items if i.product_id == request.product_id), None)
        if existing_item:
            new_qty = existing_item.quantity + request.quantity
            if product.stock_qty < new_qty and not product.is_dropship_enabled:
                raise InsufficientStockError(product.sku, new_qty, product.stock_qty)
            existing_item.quantity = new_qty
        else:
            new_item = CartItem(
                product_id=request.product_id,
                quantity=request.quantity,
            )
            cart.items.append(new_item)

        await self.db.flush()
        return await self.get_cart(partner_id, session_id)

    async def update_cart_item(
        self,
        item_id: int,
        request: UpdateCartItemRequest,
        partner_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> CartSchema:
        """Update an item only when it belongs to the caller's cart owner."""
        self._require_cart_owner(partner_id=partner_id, session_id=session_id)
        cart = await self._find_cart(partner_id, session_id)
        if not cart:
            raise ResourceNotFoundError("Cart", self._cart_identifier(partner_id, session_id))

        item = next((entry for entry in cart.items if entry.id == item_id), None)
        if not item:
            raise ResourceNotFoundError("CartItem", item_id)

        product = await self.db.scalar(
            select(ProductTemplate).where(ProductTemplate.id == item.product_id)
        )
        if not product or not product.is_active:
            raise ResourceNotFoundError("Product", item.product_id)
        if product.stock_qty < request.quantity and not product.is_dropship_enabled:
            raise InsufficientStockError(product.sku, request.quantity, product.stock_qty)

        item.quantity = request.quantity
        await self.db.flush()
        return await self.get_cart(partner_id, session_id)

    async def remove_from_cart(
        self,
        item_id: int,
        partner_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> CartSchema:
        """Remove an item only when it belongs to the caller's cart owner."""
        self._require_cart_owner(partner_id=partner_id, session_id=session_id)
        cart = await self._find_cart(partner_id, session_id)
        if not cart:
            raise ResourceNotFoundError("Cart", self._cart_identifier(partner_id, session_id))

        item = next((entry for entry in cart.items if entry.id == item_id), None)
        if not item:
            raise ResourceNotFoundError("CartItem", item_id)

        await self.db.delete(item)
        await self.db.flush()
        return await self.get_cart(partner_id, session_id)

    async def _find_cart(
        self, partner_id: Optional[int] = None, session_id: Optional[str] = None
    ) -> Optional[Cart]:
        """Query an active cart without crossing user/session ownership boundaries."""
        query = (
            select(Cart)
            .options(selectinload(Cart.items))
            .execution_options(populate_existing=True)
            .where(Cart.is_active.is_(True))
        )
        if partner_id is not None:
            query = query.where(Cart.partner_id == partner_id)
        elif session_id:
            query = query.where(
                Cart.partner_id.is_(None),
                Cart.session_id == session_id,
            )
        else:
            return None
        res = await self.db.execute(query.order_by(Cart.id.desc()).limit(1))
        return res.scalars().first()

    async def _products_by_id(self, cart_items: list[CartItem]) -> dict[int, ProductTemplate]:
        product_ids = {item.product_id for item in cart_items}
        if not product_ids:
            return {}

        result = await self.db.execute(
            select(ProductTemplate).where(ProductTemplate.id.in_(product_ids))
        )
        return {product.id: product for product in result.scalars().all()}

    async def _load_cart(self, cart_id: int) -> Cart:
        result = await self.db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .execution_options(populate_existing=True)
            .where(Cart.id == cart_id)
        )
        cart = result.scalar_one_or_none()
        if cart is None:
            raise ResourceNotFoundError("Cart", cart_id)
        return cart

    @staticmethod
    def _require_cart_owner(*, partner_id: Optional[int], session_id: Optional[str]) -> None:
        if partner_id is None and not session_id:
            raise ValueError("A partner_id or non-empty guest session_id is required.")

    @staticmethod
    def _cart_identifier(partner_id: Optional[int], session_id: Optional[str]) -> str | int:
        return partner_id if partner_id is not None else (session_id or "guest")

    # ── Checkout Orchestration ───────────────────────────────────────────────

    async def checkout(
        self,
        request: CheckoutRequest,
        partner_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> CheckoutResponse:
        """
        Execute checkout with server pricing, atomic stock reservation, and a
        Paymob-hosted payment intention for card or mobile-wallet payments.
        """
        paymob_settings = (
            ensure_paymob_is_configured(payment_method=request.payment_method)
            if request.payment_method in ELECTRONIC_PAYMENT_METHODS
            else None
        )

        is_guest_checkout = partner_id is None
        if is_guest_checkout:
            session_id = (session_id or "").strip()
            if not session_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A non-empty session_id is required for guest checkout.",
                )
            self._require_guest_contact_details(request)
            cart = await self._find_cart(session_id=session_id)
            cart_identifier: str | int = session_id
        else:
            cart = await self._find_cart(partner_id=partner_id)
            cart_identifier = partner_id

        if not cart or not cart.items:
            raise ResourceNotFoundError("Cart", cart_identifier)

        if is_guest_checkout:
            order_partner = await self._get_or_create_guest_partner(request)
        else:
            order_partner = await self.db.scalar(
                select(Partner).where(Partner.id == partner_id)
            )
            if order_partner is None:
                raise ResourceNotFoundError("Partner", partner_id or 0)
        order_partner_id = order_partner.id

        billing_name = request.customer_name or order_partner.name
        billing_email = (
            str(request.customer_email).strip().lower()
            if request.customer_email is not None
            else order_partner.email.strip().lower()
        )
        billing_mobile = (request.customer_mobile or order_partner.phone or "").strip()
        if request.payment_method in ELECTRONIC_PAYMENT_METHODS:
            if not billing_email or billing_email.endswith(".elitedom.local"):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="A deliverable billing email is required for electronic payment.",
                )
            if not billing_mobile:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="A billing mobile number is required for electronic payment.",
                )

        products_by_id = await self._products_by_id(cart.items)

        subtotal = Decimal("0.00")
        is_dropship_order = False
        requested_quantities: dict[int, int] = {}
        for item in cart.items:
            prod = products_by_id.get(item.product_id)
            if not prod or not prod.is_active:
                raise ResourceNotFoundError("Product", item.product_id)
            requested_quantities[item.product_id] = (
                requested_quantities.get(item.product_id, 0) + item.quantity
            )
            if prod.is_dropship_enabled:
                is_dropship_order = True
            subtotal += prod.list_price * item.quantity

        for product_id, quantity in requested_quantities.items():
            prod = products_by_id[product_id]
            if prod.stock_qty < quantity and not prod.is_dropship_enabled:
                raise InsufficientStockError(prod.sku, quantity, prod.stock_qty)

        shipping_fee = GOVERNORATE_SHIPPING_RATES.get(
            request.shipping_governorate, DEFAULT_SHIPPING_RATE
        )
        tax = ((subtotal + shipping_fee) * Decimal("0.14")).quantize(
            MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )
        total = (subtotal + shipping_fee + tax).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

        order_number = f"SO-{datetime.now(UTC):%Y}-{uuid4().hex[:6].upper()}"
        currency = (
            str(paymob_settings.paymob_currency).strip().upper()
            if paymob_settings is not None
            else "EGP"
        )

        sale_order = SaleOrder(
            name=order_number,
            partner_id=order_partner_id,
            state="draft",
            payment_method=request.payment_method.value,
            payment_status="pending",
            amount_subtotal=subtotal,
            amount_shipping=shipping_fee,
            amount_tax=tax,
            amount_total=total,
            currency=currency,
            shipping_address=request.shipping_address,
            shipping_governorate=request.shipping_governorate,
            is_dropship=is_dropship_order,
            notes=request.notes,
        )
        self.db.add(sale_order)
        await self.db.flush()

        for item in cart.items:
            prod = products_by_id[item.product_id]
            line = SaleOrderLine(
                order_id=sale_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=prod.list_price,
                discount_percent=Decimal("0.00"),
                line_total=prod.list_price * item.quantity,
            )
            self.db.add(line)

        await self._reserve_non_dropship_stock(products_by_id, requested_quantities)

        payment_gateway_url: str | None = None
        payment_attempt: PaymentAttempt | None = None
        paymob_intention_id: str | None = None
        if request.payment_method in ELECTRONIC_PAYMENT_METHODS:
            payment_attempt = PaymentAttempt(
                order_id=sale_order.id,
                provider="paymob",
                payment_method=request.payment_method.value,
                status="initializing",
                amount_minor=to_minor_units(total),
                currency=currency,
                idempotency_key=(
                    f"paymob:{sale_order.name}:{request.payment_method.value}"
                ),
                provider_reference=sale_order.name,
            )
            self.db.add(payment_attempt)
            await self.db.flush()

            first_name, last_name = self._split_customer_name(billing_name)
            paymob_items = [
                {
                    "name": products_by_id[item.product_id].name,
                    "amount": to_minor_units(products_by_id[item.product_id].list_price),
                    "description": products_by_id[item.product_id].sku,
                    "quantity": item.quantity,
                }
                for item in cart.items
            ]
            delivery_and_tax = shipping_fee + tax
            if delivery_and_tax:
                paymob_items.append(
                    {
                        "name": "Delivery and VAT",
                        "amount": to_minor_units(delivery_and_tax),
                        "description": request.shipping_governorate,
                        "quantity": 1,
                    }
                )

            intention = await PaymobClient(settings=paymob_settings).create_intention(
                amount=total,
                currency=currency,
                payment_method=request.payment_method,
                merchant_reference=sale_order.name,
                order_id=sale_order.id,
                items=paymob_items,
                billing_data={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": billing_email,
                    "phone_number": billing_mobile,
                    "apartment": "NA",
                    "floor": "NA",
                    "street": request.shipping_address,
                    "building": "NA",
                    "city": request.shipping_governorate,
                    "country": "EG",
                },
                customer={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": billing_email,
                },
            )
            payment_attempt.status = "pending"
            payment_attempt.provider_intention_id = intention.id
            payment_attempt.provider_order_id = intention.provider_order_id
            payment_attempt.provider_reference = (
                intention.special_reference or sale_order.name
            )
            payment_gateway_url = intention.checkout_url
            paymob_intention_id = intention.id
        elif request.payment_method == PaymentMethod.COD:
            sale_order.state = OrderState.SENT.value

        if is_guest_checkout:
            cart.partner_id = order_partner_id
        cart.is_active = False
        await self.db.flush()

        completed_order = await self._load_order(sale_order.id)

        await publish_domain_event(
            self.db,
            CartCheckedOut(
                payload={
                    "cart_id": cart.id,
                    "order_id": completed_order.id,
                    "partner_id": order_partner_id,
                    "guest_checkout": is_guest_checkout,
                }
            ),
        )
        await publish_domain_event(
            self.db,
            OrderCreated(
                payload={
                    "order_id": completed_order.id,
                    "order_number": completed_order.name,
                    "partner_id": order_partner_id,
                    "total_amount": float(completed_order.amount_total),
                    "payment_provider": (
                        payment_attempt.provider if payment_attempt else None
                    ),
                    "payment_attempt_id": (
                        payment_attempt.id if payment_attempt else None
                    ),
                }
            ),
        )

        logger.info(
            "Order checkout completed: %s (ID: %s, guest=%s)",
            completed_order.name,
            completed_order.id,
            is_guest_checkout,
        )

        return CheckoutResponse(
            order=SaleOrderResponse.model_validate(completed_order),
            payment_gateway_url=payment_gateway_url,
            payment_provider=payment_attempt.provider if payment_attempt else None,
            payment_attempt_id=payment_attempt.id if payment_attempt else None,
            paymob_intention_id=paymob_intention_id,
            stripe_session_id=completed_order.stripe_session_id,
        )

    async def _reserve_non_dropship_stock(
        self,
        products_by_id: dict[int, ProductTemplate],
        requested_quantities: dict[int, int],
    ) -> None:
        """Reserve non-dropship stock with conditional, atomic decrements."""
        for product_id, quantity in requested_quantities.items():
            product = products_by_id[product_id]
            if product.is_dropship_enabled:
                continue

            reservation = await self.db.execute(
                update(ProductTemplate)
                .where(
                    ProductTemplate.id == product_id,
                    ProductTemplate.is_active.is_(True),
                    ProductTemplate.is_dropship_enabled.is_(False),
                    ProductTemplate.stock_qty >= quantity,
                )
                .values(stock_qty=ProductTemplate.stock_qty - quantity)
            )
            if reservation.rowcount != 1:
                raise InsufficientStockError(product.sku, quantity, product.stock_qty)

    @staticmethod
    def _split_customer_name(name: str) -> tuple[str, str]:
        parts = [part for part in name.strip().split() if part]
        if not parts:
            return "Customer", "Customer"
        if len(parts) == 1:
            return parts[0], parts[0]
        return parts[0], " ".join(parts[1:])

    @staticmethod
    def _require_guest_contact_details(request: CheckoutRequest) -> None:
        if not all(
            (
                request.customer_name,
                request.customer_email,
                request.customer_mobile,
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "customer_name, customer_email, and customer_mobile are required "
                    "for guest checkout."
                ),
            )

    async def _get_or_create_guest_partner(self, request: CheckoutRequest) -> Partner:
        """Resolve a guest purchaser to one unique, non-authenticated partner record."""
        self._require_guest_contact_details(request)
        email = str(request.customer_email).lower()
        partner = await self._find_partner_by_email(email)
        if partner is not None:
            if partner.password_hash or partner.email_verified:
                raise ResourceConflictError(
                    "This email belongs to an existing account. Sign in to place this order."
                )
            return partner

        partner = Partner(
            name=request.customer_name or "Guest customer",
            email=email,
            phone=request.customer_mobile or "",
            password_hash=None,
            company_type="person",
            role="customer",
            governorate=request.shipping_governorate,
            street_address=request.shipping_address,
            email_verified=False,
        )

        try:
            async with self.db.begin_nested():
                self.db.add(partner)
                await self.db.flush()
        except IntegrityError:
            partner = await self._find_partner_by_email(email)
            if partner is None:
                raise

        return partner

    async def _find_partner_by_email(self, email: str) -> Optional[Partner]:
        result = await self.db.execute(
            select(Partner)
            .where(func.lower(Partner.email) == email.lower())
            .order_by(Partner.id.asc())
            .limit(1)
        )
        return result.scalars().first()

    async def _load_order(self, order_id: int) -> SaleOrder:
        result = await self.db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)
        return order

    # ── Order State Machine ──────────────────────────────────────────────────

    async def update_order_state(
        self, order_id: int, target_state: OrderState
    ) -> SaleOrderResponse:
        """
        Transition order through valid state machine steps (FR-ORD-002):
        draft → confirmed (sale) → shipped → done / cancelled.
        """
        res = await self.db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id)
        )
        order = res.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)

        current_state = OrderState(order.state)
        valid_targets = VALID_STATE_TRANSITIONS.get(current_state, set())

        if target_state not in valid_targets:
            raise InvalidOrderStateTransition(current_state.value, target_state.value)

        order.state = target_state.value
        await self.db.flush()

        if target_state == OrderState.SALE:
            await publish_domain_event(
                self.db, OrderConfirmed(payload={"order_id": order.id, "order_number": order.name})
            )

        logger.info(f"Order state updated: {order.name} → {target_state.value}")
        return SaleOrderResponse.model_validate(order)
