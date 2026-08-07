"""Typed contracts for the Stage 8 catalogue-content layer."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CatalogLocale = Literal["en", "ar"]
PublicationStatus = Literal["draft", "published", "archived"]
AttributeDataType = Literal["text", "number", "boolean"]


class CatalogCategoryResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    image_url: str | None = None
    is_featured: bool = False
    children: list["CatalogCategoryResponse"] = Field(default_factory=list)


class CatalogAttributeResponse(BaseModel):
    definition_id: int
    code: str
    label: str
    data_type: AttributeDataType
    value: str
    unit: str | None = None
    is_filterable: bool
    sort_order: int


class CatalogImageResponse(BaseModel):
    id: int
    url: str
    alt_text: str | None = None
    caption: str | None = None
    sort_order: int
    is_primary: bool
    mime_type: str | None = None
    byte_size: int | None = None
    width: int | None = None
    height: int | None = None
    sha256: str | None = None
    storage_provider: str = "local"


class CatalogProductResponse(BaseModel):
    id: int
    slug: str
    sku: str
    name: str
    short_description: str | None = None
    description: str | None = None
    brand: str | None = None
    list_price: Decimal
    stock_qty: int
    is_dropship_enabled: bool
    warranty_months: int
    category: CatalogCategoryResponse | None = None
    is_featured: bool = False
    images: list[CatalogImageResponse] = Field(default_factory=list)
    attributes: list[CatalogAttributeResponse] = Field(default_factory=list)
    seo_title: str | None = None
    seo_description: str | None = None
    published_at: datetime | None = None


class CatalogProductListResponse(BaseModel):
    products: list[CatalogProductResponse]
    total_count: int
    page: int
    limit: int


class ProductCatalogContentAdminResponse(BaseModel):
    product_id: int
    slug: str
    name: str
    name_ar: str | None = None
    short_description: str | None = None
    short_description_ar: str | None = None
    description: str | None = None
    description_ar: str | None = None
    seo_title: str | None = None
    seo_title_ar: str | None = None
    seo_description: str | None = None
    seo_description_ar: str | None = None
    publication_status: PublicationStatus
    is_featured: bool
    published_at: datetime | None = None


class ProductCatalogContentUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    slug: str | None = Field(default=None, min_length=2, max_length=180)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    name_ar: str | None = Field(default=None, max_length=255)
    short_description: str | None = Field(default=None, max_length=1000)
    short_description_ar: str | None = Field(default=None, max_length=1000)
    description: str | None = None
    description_ar: str | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_title_ar: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=320)
    seo_description_ar: str | None = Field(default=None, max_length=320)
    publication_status: PublicationStatus | None = None
    is_featured: bool | None = None


class CatalogCategoryAdminResponse(BaseModel):
    id: int
    name: str
    name_ar: str | None = None
    slug: str
    parent_id: int | None = None
    description: str | None = None
    description_ar: str | None = None
    seo_title: str | None = None
    seo_title_ar: str | None = None
    seo_description: str | None = None
    seo_description_ar: str | None = None
    image_url: str | None = None
    is_featured: bool
    sort_order: int
    is_active: bool


class CatalogCategoryUpsertRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=2, max_length=128)
    name_ar: str | None = Field(default=None, max_length=128)
    slug: str = Field(..., min_length=2, max_length=128)
    parent_id: int | None = Field(default=None, ge=1)
    description: str | None = None
    description_ar: str | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_title_ar: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=320)
    seo_description_ar: str | None = Field(default=None, max_length=320)
    image_url: str | None = Field(default=None, max_length=512)
    is_featured: bool = False
    sort_order: int = Field(default=0, ge=-100_000, le=100_000)
    is_active: bool = True


class CatalogAttributeDefinitionResponse(BaseModel):
    id: int
    code: str
    name: str
    name_ar: str | None = None
    data_type: AttributeDataType
    unit: str | None = None
    unit_ar: str | None = None
    is_filterable: bool
    is_active: bool
    sort_order: int


class CatalogAttributeDefinitionUpsertRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    code: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    name: str = Field(..., min_length=2, max_length=128)
    name_ar: str | None = Field(default=None, max_length=128)
    data_type: AttributeDataType = "text"
    unit: str | None = Field(default=None, max_length=32)
    unit_ar: str | None = Field(default=None, max_length=32)
    is_filterable: bool = True
    is_active: bool = True
    sort_order: int = Field(default=0, ge=-100_000, le=100_000)


class CatalogAttributeValueInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    attribute_id: int = Field(..., ge=1)
    value_text: str | None = Field(default=None, max_length=512)
    value_text_ar: str | None = Field(default=None, max_length=512)
    value_number: Decimal | None = None
    value_boolean: bool | None = None
    sort_order: int = Field(default=0, ge=-100_000, le=100_000)

    @model_validator(mode="after")
    def require_one_value(self) -> "CatalogAttributeValueInput":
        values = [self.value_text, self.value_number, self.value_boolean]
        if sum(value is not None for value in values) != 1:
            raise ValueError("Exactly one value field must be supplied.")
        return self


class ProductAttributeReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attributes: list[CatalogAttributeValueInput] = Field(default_factory=list, max_length=100)

    @field_validator("attributes")
    @classmethod
    def unique_attribute_ids(
        cls, value: list[CatalogAttributeValueInput]
    ) -> list[CatalogAttributeValueInput]:
        ids = [item.attribute_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Each attribute may appear only once per product.")
        return value


class CatalogMediaUploadResponse(BaseModel):
    image: CatalogImageResponse


class CatalogMediaOrderItem(BaseModel):
    image_id: int = Field(..., ge=1)
    sort_order: int = Field(..., ge=0, le=10_000)
    is_primary: bool = False
    alt_text: str | None = Field(default=None, max_length=255)
    caption: str | None = Field(default=None, max_length=255)
    caption_ar: str | None = Field(default=None, max_length=255)


class CatalogMediaOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    images: list[CatalogMediaOrderItem] = Field(..., min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_media_order(self) -> "CatalogMediaOrderRequest":
        image_ids = [item.image_id for item in self.images]
        if len(image_ids) != len(set(image_ids)):
            raise ValueError("Each image may appear only once.")
        if sum(item.is_primary for item in self.images) != 1:
            raise ValueError("Exactly one image must be primary.")
        return self
