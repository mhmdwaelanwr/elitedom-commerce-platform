"""Stage 8 catalogue-content persistence models.

These tables deliberately extend the commerce catalogue without changing the
Odoo-facing product_template contract used by inventory, orders, and supplier
workflows.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProductCatalogContent(Base):
    __tablename__ = "elitedom_product_catalog_content"

    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_template.id", ondelete="CASCADE"),
        primary_key=True,
    )
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    name_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    short_description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_title_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(320), nullable=True)
    seo_description_ar: Mapped[str | None] = mapped_column(String(320), nullable=True)
    publication_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    product = relationship("ProductTemplate")

    __table_args__ = (
        CheckConstraint(
            "publication_status IN ('draft', 'published', 'archived')",
            name="ck_product_catalog_content_publication_status",
        ),
        Index(
            "ix_product_catalog_content_status_featured",
            "publication_status",
            "is_featured",
        ),
    )


class CategoryCatalogContent(Base):
    __tablename__ = "elitedom_category_catalog_content"

    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_public_category.id", ondelete="CASCADE"),
        primary_key=True,
    )
    name_ar: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_title_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(320), nullable=True)
    seo_description_ar: Mapped[str | None] = mapped_column(String(320), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    category = relationship("ProductCategory")


class ProductAttributeDefinition(Base):
    __tablename__ = "elitedom_product_attribute_definition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(128), nullable=True)
    data_type: Mapped[str] = mapped_column(String(16), nullable=False, default="text")
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unit_ar: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_filterable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    values: Mapped[list[ProductAttributeValue]] = relationship(
        back_populates="attribute",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "data_type IN ('text', 'number', 'boolean')",
            name="ck_product_attribute_definition_data_type",
        ),
    )


class ProductAttributeValue(Base):
    __tablename__ = "elitedom_product_attribute_value"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_template.id", ondelete="CASCADE"),
        nullable=False,
    )
    attribute_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("elitedom_product_attribute_definition.id", ondelete="CASCADE"),
        nullable=False,
    )
    value_text: Mapped[str | None] = mapped_column(String(512), nullable=True)
    value_text_ar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    value_number: Mapped[Decimal | None] = mapped_column(Numeric(16, 4), nullable=True)
    value_boolean: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    attribute: Mapped[ProductAttributeDefinition] = relationship(back_populates="values")
    product = relationship("ProductTemplate")

    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "attribute_id",
            name="uq_product_attribute_value_product_attribute",
        ),
        Index("ix_product_attribute_value_product", "product_id", "sort_order"),
        Index("ix_product_attribute_value_attribute", "attribute_id", "value_text"),
    )


class ProductMediaMetadata(Base):
    __tablename__ = "elitedom_product_media_metadata"

    image_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_image.id", ondelete="CASCADE"),
        primary_key=True,
    )
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)
    caption_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    storage_provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="local", server_default="local"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    image = relationship("ProductImage")
