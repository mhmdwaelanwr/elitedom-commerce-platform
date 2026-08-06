# Catalogue ownership and Odoo synchronization

## Ownership model

Odoo owns SKU identity, sellability, product name, price, category, stock, tracking mode, warranty metadata, and archive state. FastAPI persists the commerce read model. Staff-managed product images and merchandising order remain local so an ERP edit cannot erase a curated storefront gallery.

## Event flow

1. A published Odoo product or variant is created, edited, archived, or assigned an SKU.
2. `elitedom_connector` writes a `product.catalog.updated` record to the same durable outbox used by inventory and order-status events.
3. The cron dispatcher signs the canonical body with HMAC SHA-256 and sends it to `/api/v1/webhooks/odoo/product` with an idempotency key.
4. FastAPI claims a webhook receipt, upserts category/product data by SKU, preserves an existing local gallery, and publishes a local domain event.
5. The Next.js storefront reads only the live FastAPI catalogue. A static demo fallback is available only when `NEXT_PUBLIC_DEMO_CATALOG_FALLBACK=true` is explicitly set.

## Odoo operator steps

- Install or upgrade `elitedom_connector`.
- Configure the FastAPI webhook base URL and shared secret.
- On a product, set an internal reference/SKU and enable **Publish to Elitedom Store**.
- Set the storefront brand, warranty, dropship flag, and optional HTTPS image seed URLs.
- Inspect **Technical → Elitedom Webhook Outbox** for pending, delivered, or dead-letter events.

## Media

Staff uploads accept JPEG, PNG, and WebP only, with a default 5 MB limit. Files receive generated names under `/app/media/products/<product-id>/` and are served from `/media`. The Docker volume is persistent for a single-host deployment; use object storage/CDN for scalable production.
