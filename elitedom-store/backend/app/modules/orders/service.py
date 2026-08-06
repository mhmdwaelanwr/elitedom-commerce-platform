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

from app.integrations.stripe.checkout import (
    create_checkout_session,
    ensure_stripe_checkout_is_configured,
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
            # Authenticated carts are identified only by their partner.  A
            # session id always identifies a guest cart and must not become a
            # second way to access an authenticated cart.
            cart = Cart(
                partner_id=partner_id,
                session_id=session_id if partner_id is None else None,
                is_active=True,
            )
            self.db.add(cart)
            await self.db.flush()
            cart = await self._load_cart(cart.id)

        # Build schema response with product details
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

        # Verify product exists and has stock
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

        # Check if item already in cart
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
            # Keep the already-loaded relationship accurate for the response
            # in the same request, rather than relying on a later lazy load.
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
            # Do not disclose whether the id belongs to another session/cart.
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
            # Do not disclose whether the id belongs to another session/cart.
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
            # Guest cart lookup must never match a cart already owned by a
            # partner, even if someone happens to know its historical session.
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
        Execute streamlined checkout (FR-CART-002):
        1. Validate cart items & stock
        2. Calculate governorate shipping fee (FR-CART-004) & VAT (14%)
        3. Create SaleOrder & SaleOrderLine
        4. Atomically reserve local stock and initialize Stripe when needed
        5. Deactivate Cart
        6. Publish CartCheckedOut & OrderCreated domain events
        """
        # Validate Stripe before looking up/creating a guest partner, order,
        # or making any other durable checkout mutation.  The service will use
        # this same settings object when it creates the hosted session below.
        stripe_settings = (
            ensure_stripe_checkout_is_configured()
            if request.payment_method == PaymentMethod.CREDIT_CARD
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

        # A guest order still needs a durable customer/partner record because
        # SaleOrder.partner_id is non-null.  We reuse an existing email record
        # without altering its account data; new guest partners never receive a
        # password hash and therefore cannot authenticate until they register.
        order_partner_id = (
            (await self._get_or_create_guest_partner(request)).id
            if is_guest_checkout
            else partner_id
        )

        if order_partner_id is None:
            # Defensive guard for static type narrowing and database integrity.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to determine the order customer.",
            )

        products_by_id = await self._products_by_id(cart.items)

        # Calculate totals
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

        # Cart items are normally unique per product, but aggregate quantities
        # defensively so an inconsistent legacy cart cannot bypass stock checks.
        for product_id, quantity in requested_quantities.items():
            prod = products_by_id[product_id]
            if prod.stock_qty < quantity and not prod.is_dropship_enabled:
                raise InsufficientStockError(prod.sku, quantity, prod.stock_qty)

        shipping_fee = GOVERNORATE_SHIPPING_RATES.get(
            request.shipping_governorate, DEFAULT_SHIPPING_RATE
        )
        tax = ((subtotal + shipping_fee) * Decimal("0.14")).quantize(
            MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )  # 14% Egyptian VAT
        total = (subtotal + shipping_fee + tax).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

        # Create unique order reference
        order_number = f"SO-{datetime.now(UTC):%Y}-{uuid4().hex[:6].upper()}"

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
            # The currency is part of the immutable priced order.  It is
            # later compared with the signed Stripe event before payment can
            # transition to paid.
            currency=(
                str(stripe_settings.stripe_currency).strip().upper()
                if stripe_settings is not None
                else "EGP"
            ),
            shipping_address=request.shipping_address,
            shipping_governorate=request.shipping_governorate,
            is_dropship=is_dropship_order,
            notes=request.notes,
        )
        self.db.add(sale_order)
        await self.db.flush()

        # Create lines
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

        # The conditional UPDATE is the final concurrency-safe inventory
        # guard: two concurrent checkouts cannot both sell the last unit.  A
        # Stripe error after this point aborts the request transaction and
        # therefore restores the reservation automatically.
        await self._reserve_non_dropship_stock(products_by_id, requested_quantities)

        payment_gateway_url: str | None = None
        if request.payment_method == PaymentMethod.CREDIT_CARD:
            stripe_session = await create_checkout_session(
                order=sale_order,
                cart_items=cart.items,
                products_by_id=products_by_id,
                settings=stripe_settings,
            )
            sale_order.stripe_session_id = stripe_session.id
            sale_order.stripe_payment_intent_id = stripe_session.payment_intent_id
            payment_gateway_url = stripe_session.url
        elif request.payment_method == PaymentMethod.COD:
            # COD stock is reserved at checkout, so make it visible to the
            # warehouse without incorrectly claiming that it has been paid.
            sale_order.state = OrderState.SENT.value

        # Associate the completed guest cart with the resulting partner for
        # traceability, then make it inaccessible to either guest or account
        # cart endpoints.  Authenticated carts already have this partner id.
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
            # A payment URL is returned only after a real Stripe session is
            # created.  It is never manufactured from an order id.
            payment_gateway_url=payment_gateway_url,
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
                # ``product.stock_qty`` may be stale after a competing order,
                # but the error remains safe and the enclosing transaction
                # rolls back all earlier reservations from this checkout.
                raise InsufficientStockError(product.sku, quantity, product.stock_qty)

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
            # Never attach an anonymous checkout to an account that can already
            # authenticate (including an OAuth-only account).  Reusing only
            # passwordless, unverified guest records preserves guest order
            # history without allowing an email-only account takeover.
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

        # The normal lookup covers the common path.  A savepoint lets a
        # simultaneous first checkout for the same email safely fall back to
        # the row that won the unique-email race without invalidating checkout.
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
