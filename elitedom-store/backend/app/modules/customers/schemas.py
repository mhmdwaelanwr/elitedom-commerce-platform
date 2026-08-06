"""Pydantic contracts for the authenticated customer account portal."""

import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

_EGYPTIAN_MOBILE_RE = re.compile(r"^(\+20|0)1[0125]\d{8}$")


def _normalize_mobile(value: str) -> str:
    """Normalize and validate an Egyptian mobile number used for deliveries."""
    normalized = re.sub(r"[\s-]", "", value)
    if not _EGYPTIAN_MOBILE_RE.match(normalized):
        raise ValueError("Invalid Egyptian mobile number. Expected +201XXXXXXXXX or 01XXXXXXXXX.")
    return normalized


class CustomerProfileResponse(BaseModel):
    """Safe account information returned to the authenticated account holder."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    # Phone-only accounts retain a non-public internal identifier because the
    # legacy Partner schema still requires a database email value. New email
    # input remains strictly validated by UpdateCustomerProfileRequest.
    email: str
    phone: str
    company_type: str
    governorate: str | None = None
    street_address: str | None = None
    role: str
    email_verified: bool
    created_at: datetime
    updated_at: datetime | None = None


class UpdateCustomerProfileRequest(BaseModel):
    """Mutable personal fields; role and account state are intentionally excluded."""

    name: str | None = Field(default=None, min_length=2, max_length=128)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=10, max_length=20)
    governorate: str | None = Field(default=None, min_length=2, max_length=64)
    street_address: str | None = Field(default=None, min_length=5, max_length=500)
    mobile_fcm_token: str | None = Field(default=None, max_length=255)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return _normalize_mobile(value) if value is not None else value

    @model_validator(mode="after")
    def require_an_update(self) -> "UpdateCustomerProfileRequest":
        if not self.model_fields_set:
            raise ValueError("At least one profile field must be supplied.")
        return self


class CustomerAddressCreateRequest(BaseModel):
    """A new shipping address owned by the authenticated customer."""

    label: str = Field(default="Home", min_length=1, max_length=64)
    recipient_name: str = Field(..., min_length=2, max_length=128)
    recipient_phone: str = Field(..., min_length=10, max_length=20)
    street_address: str = Field(..., min_length=5, max_length=500)
    address_line_2: str | None = Field(default=None, max_length=500)
    city: str = Field(..., min_length=2, max_length=64)
    governorate: str = Field(..., min_length=2, max_length=64)
    postal_code: str | None = Field(default=None, max_length=16)
    country: str = Field(default="Egypt", min_length=2, max_length=64)
    is_default: bool = False

    @field_validator("recipient_phone")
    @classmethod
    def validate_recipient_phone(cls, value: str) -> str:
        return _normalize_mobile(value)


class CustomerAddressUpdateRequest(BaseModel):
    """Partial address update; a default can be selected through this payload."""

    label: str | None = Field(default=None, min_length=1, max_length=64)
    recipient_name: str | None = Field(default=None, min_length=2, max_length=128)
    recipient_phone: str | None = Field(default=None, min_length=10, max_length=20)
    street_address: str | None = Field(default=None, min_length=5, max_length=500)
    address_line_2: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, min_length=2, max_length=64)
    governorate: str | None = Field(default=None, min_length=2, max_length=64)
    postal_code: str | None = Field(default=None, max_length=16)
    country: str | None = Field(default=None, min_length=2, max_length=64)
    is_default: bool | None = None

    @field_validator("recipient_phone")
    @classmethod
    def validate_recipient_phone(cls, value: str | None) -> str | None:
        return _normalize_mobile(value) if value is not None else value

    @model_validator(mode="after")
    def validate_update(self) -> "CustomerAddressUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one address field must be supplied.")

        required_fields = {
            "label",
            "recipient_name",
            "recipient_phone",
            "street_address",
            "city",
            "governorate",
            "country",
            "is_default",
        }
        null_required_fields = [
            field
            for field in required_fields.intersection(self.model_fields_set)
            if getattr(self, field) is None
        ]
        if null_required_fields:
            raise ValueError(
                f"Address fields cannot be null: {', '.join(sorted(null_required_fields))}."
            )
        return self


class CustomerAddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    recipient_name: str
    recipient_phone: str
    street_address: str
    address_line_2: str | None = None
    city: str
    governorate: str
    postal_code: str | None = None
    country: str
    is_default: bool
    created_at: datetime
    updated_at: datetime | None = None


class CustomerAddressListResponse(BaseModel):
    addresses: list[CustomerAddressResponse] = Field(default_factory=list)


class WishlistAddRequest(BaseModel):
    product_id: int = Field(..., ge=1)


class WishlistProductResponse(BaseModel):
    """The current product snapshot shown alongside a saved wishlist item."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    list_price: Decimal
    stock_qty: int
    is_active: bool
    brand: str | None = None


class WishlistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    created_at: datetime
    product: WishlistProductResponse


class WishlistResponse(BaseModel):
    items: list[WishlistItemResponse] = Field(default_factory=list)
