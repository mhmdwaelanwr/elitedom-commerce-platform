# Stage 8 — Advanced Catalog, Content & Media

Stage 8 adds a merchandising/content layer around the existing inventory-safe SKU master without changing order, fulfillment, supplier, or Odoo product identity.

## Architectural boundary

`product_template` remains the commerce SKU used by inventory reservations, order lines, Odoo sync, supplier mappings, and fulfillment. Stage 8 deliberately does **not** introduce a parent/variant model that would change those identifiers.

New content tables extend that master instead:

- `elitedom_product_catalog_content`
- `elitedom_category_catalog_content`
- `elitedom_product_attribute_definition`
- `elitedom_product_attribute_value`
- `elitedom_product_media_metadata`

This keeps operational truth stable while allowing the storefront and content team to evolve independently.

## Product content and publication

Each SKU can now have:

- stable public slug
- Arabic name and long/short descriptions
- English and Arabic SEO titles/descriptions
- `draft`, `published`, or `archived` publication state
- featured merchandising flag
- published timestamp

Existing active products are backfilled as published. Existing inactive products are backfilled as drafts.

Publishing is fail-closed. A product cannot be published unless it has:

1. an active category,
2. at least one product image,
3. an active verified supplier mapping,
4. and, for dropship products, an active verified **primary** supplier mapping.

Publication updates continue to synchronize the legacy `ProductTemplate.is_active` flag so older commerce APIs and Odoo-facing workflows remain compatible.

## Categories

Categories now retain the existing hierarchy while adding:

- Arabic name/description
- English and Arabic SEO metadata
- category image URL
- featured merchandising flag

Admin updates reject self-parenting and descendant cycles.

## Flexible attributes

Stage 8 introduces typed product attributes:

- text
- number
- boolean

Definitions support English/Arabic labels, English/Arabic units, filterability, activation, and sort order. Product values are unique per `(product, attribute)`.

The old fixed compatibility fields are migrated into initial attribute definitions and values:

- socket type
- memory type
- form factor
- power draw
- PCIe generation

The old columns are retained for backwards compatibility; Stage 8 does not remove them.

## Rich media

The previous local media backend remains supported, but new uploads are validated by decoding the image instead of trusting the file extension.

Accepted formats:

- JPEG
- PNG
- WebP

Safety/metadata controls include:

- existing configured maximum upload size
- declared MIME must match detected image format
- maximum 12,000 px per side
- maximum 40 million pixels
- SHA-256 fingerprint
- width/height
- byte size
- MIME type
- storage provider marker
- English/Arabic captions
- ordering and exactly one primary image when media order is replaced
- duplicate image detection per product
- path-safe local file deletion

The metadata boundary is provider-neutral so Stage 9 can move media behind object storage/CDN without changing product records.

## APIs

### Public

`/api/v1/catalog`

- `GET /products`
- `GET /products/{id-or-slug}`
- `GET /categories`

Public endpoints accept `locale=en|ar`. Draft and archived catalogue content is not returned.

### Staff control plane

`/api/v1/admin/catalog`

- product content read/update
- category list/create/update
- attribute definition list/create/update
- product attribute replacement
- validated media upload
- media ordering/metadata update
- media delete

All reads/writes use Stage 7 `catalog.view` / `catalog.manage` permissions from persisted staff state. Mutations create Stage 7 administrative audit records.

## Storefront

The shop now consumes the rich catalogue API and receives localized product names, descriptions, categories, SEO copy, images, and flexible specifications from the backend.

- category filters are sourced from the database rather than the static demo category list
- specification filters are generated from filterable dynamic attributes
- product URLs prefer stable content slugs
- product detail and home catalogue sections reload when locale changes
- legacy static catalogue data remains available only through the explicit demo fallback setting

## Admin UI

`/admin/catalog-content` provides a bilingual staff workspace for:

- product content / SEO / publication
- categories
- attribute definitions

The existing `/admin/products` inventory/SKU workspace links to the new content workspace. Backend permission checks remain authoritative.

## Migration guarantees

Alembic revision `0012_catalog_content_media` follows `0011_admin_rbac_audit` and supports:

- fresh database upgrade
- latest downgrade/replay
- full downgrade/replay

The migration backfills content and legacy specification values without changing inventory quantities, order lines, supplier POs, or fulfillment state.

## Deferred production work

The following are intentionally deferred to Stage 9 production hardening:

- object storage/CDN provider configuration and lifecycle policy
- image resizing/derivative generation pipeline
- cache invalidation strategy at CDN scale
- dedicated search index synchronization for the new flexible attribute model
- structured-data/SEO production validation and performance budgets

Sellable parent/variant modeling is also intentionally not introduced in Stage 8. It should only be added in a future product-model migration with explicit inventory, cart, pricing, Odoo, and fulfillment semantics.
