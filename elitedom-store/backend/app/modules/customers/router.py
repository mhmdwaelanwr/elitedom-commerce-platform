"""Authenticated customer-account endpoints for FR-AUTH-004."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
from app.modules.customers.service import CustomerService
from app.shared.security import get_current_user

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]


@router.get("/me", response_model=CustomerProfileResponse)
async def get_profile(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerProfileResponse:
    """Return the account holder's persisted personal profile."""
    return await CustomerService(db).get_profile(current_user["user_id"])


@router.put("/me", response_model=CustomerProfileResponse)
async def update_profile(
    request: UpdateCustomerProfileRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerProfileResponse:
    """Update only the authenticated account holder's personal details."""
    return await CustomerService(db).update_profile(current_user["user_id"], request)


@router.get("/me/addresses", response_model=CustomerAddressListResponse)
async def list_addresses(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerAddressListResponse:
    """List shipping addresses owned by the authenticated customer."""
    return await CustomerService(db).list_addresses(current_user["user_id"])


@router.post(
    "/me/addresses",
    response_model=CustomerAddressResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_address(
    request: CustomerAddressCreateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerAddressResponse:
    """Create another shipping address for the authenticated customer."""
    return await CustomerService(db).add_address(current_user["user_id"], request)


@router.put("/me/addresses/{address_id}", response_model=CustomerAddressResponse)
async def update_address(
    address_id: int,
    request: CustomerAddressUpdateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerAddressResponse:
    """Update a customer-owned address, including its default designation."""
    return await CustomerService(db).update_address(current_user["user_id"], address_id, request)


@router.put("/me/addresses/{address_id}/default", response_model=CustomerAddressResponse)
async def set_default_address(
    address_id: int,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> CustomerAddressResponse:
    """Mark one of the caller's addresses as the default shipping address."""
    return await CustomerService(db).set_default_address(current_user["user_id"], address_id)


@router.delete("/me/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    address_id: int,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a shipping address only when it belongs to the JWT subject."""
    await CustomerService(db).delete_address(current_user["user_id"], address_id)


@router.get("/me/wishlist", response_model=WishlistResponse)
async def get_wishlist(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> WishlistResponse:
    """Return the caller's persisted wishlist with current product data."""
    return await CustomerService(db).get_wishlist(current_user["user_id"])


@router.post(
    "/me/wishlist",
    response_model=WishlistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_wishlist_item(
    request: WishlistAddRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> WishlistItemResponse:
    """Persist a product in the caller's wishlist; duplicate adds are idempotent."""
    return await CustomerService(db).add_wishlist_item(current_user["user_id"], request)


@router.delete("/me/wishlist/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_wishlist_item(
    product_id: int,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Remove a product from the caller's wishlist without exposing other entries."""
    await CustomerService(db).remove_wishlist_item(current_user["user_id"], product_id)
