"""Add bilingual catalogue content, flexible attributes, and media metadata.

Revision ID: 0012_catalog_content_media
Revises: 0011_admin_rbac_audit
Create Date: 2026-08-07 18:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_catalog_content_media"
down_revision: str | None = "0011_admin_rbac_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_product_catalog_content",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("name_ar", sa.String(length=255), nullable=True),
        sa.Column("short_description_ar", sa.Text(), nullable=True),
        sa.Column("description_ar", sa.Text(), nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_title_ar", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.String(length=320), nullable=True),
        sa.Column("seo_description_ar", sa.String(length=320), nullable=True),
        sa.Column(
            "publication_status",
            sa.String(length=16),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "publication_status IN ('draft', 'published', 'archived')",
            name="ck_product_catalog_content_publication_status",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["product_template.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("product_id"),
        sa.UniqueConstraint("slug", name="uq_product_catalog_content_slug"),
    )
    op.create_index(
        "ix_elitedom_product_catalog_content_slug",
        "elitedom_product_catalog_content",
        ["slug"],
        unique=True,
    )
    op.create_index(
        "ix_product_catalog_content_status_featured",
        "elitedom_product_catalog_content",
        ["publication_status", "is_featured"],
        unique=False,
    )

    op.create_table(
        "elitedom_category_catalog_content",
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("name_ar", sa.String(length=128), nullable=True),
        sa.Column("description_ar", sa.Text(), nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_title_ar", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.String(length=320), nullable=True),
        sa.Column("seo_description_ar", sa.String(length=320), nullable=True),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"], ["product_public_category.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("category_id"),
    )

    op.create_table(
        "elitedom_product_attribute_definition",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("name_ar", sa.String(length=128), nullable=True),
        sa.Column("data_type", sa.String(length=16), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("unit_ar", sa.String(length=32), nullable=True),
        sa.Column("is_filterable", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "data_type IN ('text', 'number', 'boolean')",
            name="ck_product_attribute_definition_data_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_product_attribute_definition_code"),
    )
    op.create_index(
        "ix_elitedom_product_attribute_definition_code",
        "elitedom_product_attribute_definition",
        ["code"],
        unique=True,
    )

    op.create_table(
        "elitedom_product_attribute_value",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("attribute_id", sa.Integer(), nullable=False),
        sa.Column("value_text", sa.String(length=512), nullable=True),
        sa.Column("value_text_ar", sa.String(length=512), nullable=True),
        sa.Column("value_number", sa.Numeric(16, 4), nullable=True),
        sa.Column("value_boolean", sa.Boolean(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["attribute_id"],
            ["elitedom_product_attribute_definition.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["product_template.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_id",
            "attribute_id",
            name="uq_product_attribute_value_product_attribute",
        ),
    )
    op.create_index(
        "ix_product_attribute_value_product",
        "elitedom_product_attribute_value",
        ["product_id", "sort_order"],
        unique=False,
    )
    op.create_index(
        "ix_product_attribute_value_attribute",
        "elitedom_product_attribute_value",
        ["attribute_id", "value_text"],
        unique=False,
    )

    op.create_table(
        "elitedom_product_media_metadata",
        sa.Column("image_id", sa.Integer(), nullable=False),
        sa.Column("caption", sa.String(length=255), nullable=True),
        sa.Column("caption_ar", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=64), nullable=True),
        sa.Column("byte_size", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column(
            "storage_provider",
            sa.String(length=32),
            server_default=sa.text("'local'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["image_id"], ["product_image.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("image_id"),
    )
    op.create_index(
        "ix_elitedom_product_media_metadata_sha256",
        "elitedom_product_media_metadata",
        ["sha256"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO elitedom_product_catalog_content
            (product_id, slug, publication_status, is_featured, published_at)
        SELECT
            id,
            COALESCE(
                NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(sku, '[^A-Za-z0-9]+', '-', 'g'))), ''),
                'product-' || id::text
            ),
            CASE WHEN is_active THEN 'published' ELSE 'draft' END,
            FALSE,
            CASE WHEN is_active THEN COALESCE(updated_at, created_at) ELSE NULL END
        FROM product_template
        ON CONFLICT (product_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_category_catalog_content (category_id, is_featured)
        SELECT id, FALSE FROM product_public_category
        ON CONFLICT (category_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_media_metadata (image_id, storage_provider)
        SELECT id, CASE WHEN url LIKE '/media/%' THEN 'local' ELSE 'external' END
        FROM product_image
        ON CONFLICT (image_id) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO elitedom_product_attribute_definition
            (code, name, name_ar, data_type, unit, unit_ar, is_filterable, is_active, sort_order)
        VALUES
            ('socket_type', 'Socket', 'المقبس', 'text', NULL, NULL, TRUE, TRUE, 10),
            ('ram_type', 'Memory type', 'نوع الذاكرة', 'text', NULL, NULL, TRUE, TRUE, 20),
            ('form_factor', 'Form factor', 'عامل الشكل', 'text', NULL, NULL, TRUE, TRUE, 30),
            ('power_wattage_draw', 'Power', 'الطاقة', 'number', 'W', 'وات', TRUE, TRUE, 40),
            ('pcie_gen', 'PCIe', 'PCIe', 'text', NULL, NULL, TRUE, TRUE, 50)
        ON CONFLICT (code) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_attribute_value
            (product_id, attribute_id, value_text, sort_order)
        SELECT p.id, a.id, p.socket_type, a.sort_order
        FROM product_template p
        JOIN elitedom_product_attribute_definition a ON a.code = 'socket_type'
        WHERE p.socket_type IS NOT NULL
        ON CONFLICT (product_id, attribute_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_attribute_value
            (product_id, attribute_id, value_text, sort_order)
        SELECT p.id, a.id, p.ram_type, a.sort_order
        FROM product_template p
        JOIN elitedom_product_attribute_definition a ON a.code = 'ram_type'
        WHERE p.ram_type IS NOT NULL
        ON CONFLICT (product_id, attribute_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_attribute_value
            (product_id, attribute_id, value_text, sort_order)
        SELECT p.id, a.id, p.form_factor, a.sort_order
        FROM product_template p
        JOIN elitedom_product_attribute_definition a ON a.code = 'form_factor'
        WHERE p.form_factor IS NOT NULL
        ON CONFLICT (product_id, attribute_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_attribute_value
            (product_id, attribute_id, value_number, sort_order)
        SELECT p.id, a.id, p.power_wattage_draw, a.sort_order
        FROM product_template p
        JOIN elitedom_product_attribute_definition a ON a.code = 'power_wattage_draw'
        WHERE p.power_wattage_draw IS NOT NULL AND p.power_wattage_draw > 0
        ON CONFLICT (product_id, attribute_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO elitedom_product_attribute_value
            (product_id, attribute_id, value_text, sort_order)
        SELECT p.id, a.id, p.pcie_gen, a.sort_order
        FROM product_template p
        JOIN elitedom_product_attribute_definition a ON a.code = 'pcie_gen'
        WHERE p.pcie_gen IS NOT NULL
        ON CONFLICT (product_id, attribute_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_product_media_metadata_sha256",
        table_name="elitedom_product_media_metadata",
    )
    op.drop_table("elitedom_product_media_metadata")
    op.drop_index(
        "ix_product_attribute_value_attribute",
        table_name="elitedom_product_attribute_value",
    )
    op.drop_index(
        "ix_product_attribute_value_product",
        table_name="elitedom_product_attribute_value",
    )
    op.drop_table("elitedom_product_attribute_value")
    op.drop_index(
        "ix_elitedom_product_attribute_definition_code",
        table_name="elitedom_product_attribute_definition",
    )
    op.drop_table("elitedom_product_attribute_definition")
    op.drop_table("elitedom_category_catalog_content")
    op.drop_index(
        "ix_product_catalog_content_status_featured",
        table_name="elitedom_product_catalog_content",
    )
    op.drop_index(
        "ix_elitedom_product_catalog_content_slug",
        table_name="elitedom_product_catalog_content",
    )
    op.drop_table("elitedom_product_catalog_content")
