"""Business logic for the authenticated customer account portal."""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CustomerAddress, Partner, ProductTemplate, WishlistItem
from app.modules.customers.schemas import (
    CustomerAddressCreateRequest,
    CustomerAddressListResponse,
    CustomerAddressResponse,
    CustomerAddressUpdateRequest,
    CustomerProfileResponse,
    UpdateCustomerProfileRequest,
    WishlistAddRequest,
    WishlistItemResponse,
    WishlistResponse,
)
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError


class CustomerService:
    """Owns profile, shipping-address, and wishlist operations for one customer."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profile(self, partner_id: int) -> CustomerProfileResponse:
        partner = await self._get_partner(partner_id)
        return CustomerProfileResponse.model_validate(partner)

    async def update_profile(
        self, partner_id: int, request: UpdateCustomerProfileRequest
    ) -> CustomerProfileResponse:
        partner = await self._get_partner(partner_id)
        update_data = request.model_dump(exclude_unset=True)

        if "email" in update_data:
            email = str(update_data["email"]).lower()
            existing_partner_id = await self.db.scalar(
                select(Partner.id).where(
                    func.lower(Partner.email) == email,
                    Partner.id != partner_id,
                )
            )
            if existing_partner_id is not None:
                raise ResourceConflictError("An account with this email already exists.")

            if email != partner.email.lower():
                partner.email_verified = False
            update_data["email"] = email

        for field, value in update_data.items():
            setattr(partner, field, value)

        await self.db.flush()
        await self.db.refresh(partner)
        return CustomerProfileResponse.model_validate(partner)

    async def list_addresses(self, partner_id: int) -> CustomerAddressListResponse:
        await self._get_partner(partner_id)
        result = await self.db.execute(
            select(CustomerAddress)
            .where(CustomerAddress.partner_id == partner_id)
            .order_by(
                CustomerAddress.is_default.desc(),
                CustomerAddress.created_at.desc(),
                CustomerAddress.id.desc(),
            )
        )
        addresses = result.scalars().all()
        return CustomerAddressListResponse(
            addresses=[CustomerAddressResponse.model_validate(address) for address in addresses]
        )

    async def add_address(
        self, partner_id: int, request: CustomerAddressCreateRequest
    ) -> CustomerAddressResponse:
        await self._get_partner(partner_id)

        has_existing_address = await self.db.scalar(
            select(CustomerAddress.id).where(CustomerAddress.partner_id == partner_id).limit(1)
        )
        is_default = request.is_default or has_existing_address is None

        if is_default:
            await self._clear_other_default_addresses(partner_id)

        address = CustomerAddress(
            partner_id=partner_id,
            **request.model_dump(exclude={"is_default"}),
            is_default=is_default,
        )
        self.db.add(address)
        await self.db.flush()
        await self.db.refresh(address)
        return CustomerAddressResponse.model_validate(address)

    async def update_address(
        self,
        partner_id: int,
        address_id: int,
        request: CustomerAddressUpdateRequest,
    ) -> CustomerAddressResponse:
        address = await self._get_address(partner_id, address_id)
        update_data = request.model_dump(exclude_unset=True)
        requested_default = update_data.pop("is_default", None)

        if requested_default is True:
            await self._set_default_address(address)
        elif requested_default is False and address.is_default:
            replacement = await self._get_replacement_address(partner_id, address.id)
            if replacement is None:
                raise ResourceConflictError(
                    "At least one shipping address must remain the default."
                )
            replacement.is_default = True
            address.is_default = False

        for field, value in update_data.items():
            setattr(address, field, value)

        await self.db.flush()
        await self.db.refresh(address)
        return CustomerAddressResponse.model_validate(address)

    async def set_default_address(
        self, partner_id: int, address_id: int
    ) -> CustomerAddressResponse:
        address = await self._get_address(partner_id, address_id)
        await self._set_default_address(address)
        await self.db.flush()
        await self.db.refresh(address)
        return CustomerAddressResponse.model_validate(address)

    async def delete_address(self, partner_id: int, address_id: int) -> None:
        address = await self._get_address(partner_id, address_id)
        was_default = address.is_default
        await self.db.delete(address)
        await self.db.flush()

        if was_default:
            replacement = await self._get_replacement_address(partner_id, excluded_id=None)
            if replacement is not None:
                replacement.is_default = True
                await self.db.flush()

    async def get_wishlist(self, partner_id: int) -> WishlistResponse:
        await self._get_partner(partner_id)
        result = await self.db.execute(
            select(WishlistItem)
            .options(selectinload(WishlistItem.product))
            .where(WishlistItem.partner_id == partner_id)
            .order_by(WishlistItem.created_at.desc(), WishlistItem.id.desc())
        )
        items = result.scalars().all()
        return WishlistResponse(items=[WishlistItemResponse.model_validate(item) for item in items])

    async def add_wishlist_item(
        self, partner_id: int, request: WishlistAddRequest
    ) -> WishlistItemResponse:
        await self._get_partner(partner_id)
        existing = await self.db.scalar(
            select(WishlistItem)
            .options(selectinload(WishlistItem.product))
            .where(
                WishlistItem.partner_id == partner_id,
                WishlistItem.product_id == request.product_id,
            )
        )
        if existing is not None:
            return WishlistItemResponse.model_validate(existing)

        product = await self.db.scalar(
            select(ProductTemplate).where(
                ProductTemplate.id == request.product_id,
                ProductTemplate.is_active.is_(True),
            )
        )
        if product is None:
            raise ResourceNotFoundError("Product", request.product_id)

        item = WishlistItem(
            partner_id=partner_id,
            product_id=product.id,
            product=product,
        )
        self.db.add(item)
        await self.db.flush()
        return await self._get_wishlist_item_response(partner_id, item.id)

    async def remove_wishlist_item(self, partner_id: int, product_id: int) -> None:
        item = await self.db.scalar(
            select(WishlistItem).where(
                WishlistItem.partner_id == partner_id,
                WishlistItem.product_id == product_id,
            )
        )
        if item is None:
            raise ResourceNotFoundError("WishlistItem", product_id)

        await self.db.delete(item)
        await self.db.flush()

    async def _get_partner(self, partner_id: int) -> Partner:
        partner = await self.db.scalar(
            select(Partner).where(
                Partner.id == partner_id,
                Partner.is_active.is_(True),
            )
        )
        if partner is None:
            raise ResourceNotFoundError("Customer", partner_id)
        return partner

    async def _get_address(self, partner_id: int, address_id: int) -> CustomerAddress:
        address = await self.db.scalar(
            select(CustomerAddress).where(
                CustomerAddress.id == address_id,
                CustomerAddress.partner_id == partner_id,
            )
        )
        if address is None:
            # Deliberately report a missing resource rather than reveal another user's address.
            raise ResourceNotFoundError("CustomerAddress", address_id)
        return address

    async def _get_wishlist_item_response(
        self, partner_id: int, item_id: int
    ) -> WishlistItemResponse:
        item = await self.db.scalar(
            select(WishlistItem)
            .options(selectinload(WishlistItem.product))
            .where(
                WishlistItem.id == item_id,
                WishlistItem.partner_id == partner_id,
            )
        )
        if item is None:
            raise ResourceNotFoundError("WishlistItem", item_id)
        return WishlistItemResponse.model_validate(item)

    async def _set_default_address(self, address: CustomerAddress) -> None:
        await self._clear_other_default_addresses(
            partner_id=address.partner_id,
            excluded_id=address.id,
        )
        address.is_default = True

    async def _clear_other_default_addresses(
        self, partner_id: int, excluded_id: int | None = None
    ) -> None:
        statement = update(CustomerAddress).where(
            CustomerAddress.partner_id == partner_id,
            CustomerAddress.is_default.is_(True),
        )
        if excluded_id is not None:
            statement = statement.where(CustomerAddress.id != excluded_id)
        await self.db.execute(statement.values(is_default=False))

    async def _get_replacement_address(
        self, partner_id: int, excluded_id: int | None
    ) -> CustomerAddress | None:
        statement = (
            select(CustomerAddress)
            .where(CustomerAddress.partner_id == partner_id)
            .order_by(CustomerAddress.created_at.desc(), CustomerAddress.id.desc())
            .limit(1)
        )
        if excluded_id is not None:
            statement = statement.where(CustomerAddress.id != excluded_id)
        return await self.db.scalar(statement)
