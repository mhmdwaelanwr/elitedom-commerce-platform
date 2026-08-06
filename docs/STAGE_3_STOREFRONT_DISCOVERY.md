# Stage 3 — Storefront Discovery Redesign

## Scope

This delivery is PR-D from the market-readiness plan. It rebuilds the storefront discovery experience on top of the Stage 2 design system without mixing in product-detail, cart, checkout, account, authentication, payment, order-state, database, Odoo, or admin changes.

## Delivered

### Storefront header

- marketplace-style desktop and mobile header
- wide catalogue search
- live product suggestions from the public API
- localized department navigation
- desktop mega menu with category artwork
- visible wishlist, account, cart, currency, B2B, and warranty entry points
- semantic light and dark theme styling

### Home page

- fully localized Arabic and English copy
- responsive hero and promotional cards
- live inventory, VAT, fulfilment, delivery, payment, and after-sales trust indicators
- localized department discovery
- real API-backed new-arrival and available-product sections
- loading, empty, and API-error states
- responsive promotional and B2B/support banners

### Product cards

- semantic light and dark styling
- localized stock, dropship, wishlist, VAT, details, and cart actions
- locale-aware currency formatting
- responsive grid and list variants
- real product metadata, images, specifications, rating, inventory, and dropship state

### Shop and search

- no production initialization from the demo catalogue
- URL-backed search and department filters
- live public API catalogue loading
- department, availability, brand, specification, and price filters
- featured, price, and local-stock sorting
- grid and list display modes
- mobile filter drawer
- active-filter summary and reset
- client-side pagination for the loaded API result set
- localized loading, error, empty, and retry states

## Files changed

- `elitedom-store/frontend/src/app/page.tsx`
- `elitedom-store/frontend/src/app/shop/page.tsx`
- `elitedom-store/frontend/src/components/store/HomeCatalogSections.tsx`
- `elitedom-store/frontend/src/components/store/SiteHeader.tsx`
- `elitedom-store/frontend/src/components/store/StoreProductCard.tsx`
- `elitedom-store/frontend/src/components/store/StorefrontSearch.tsx`
- `elitedom-store/frontend/src/locales/en/storefront.ts`
- `elitedom-store/frontend/src/locales/ar/storefront.ts`

## Files added

- `docs/STAGE_3_STOREFRONT_DISCOVERY.md`

## Files deleted

None.

## Migrations

None.

## Environment variables

None added or renamed.

The existing `NEXT_PUBLIC_DEMO_CATALOG_FALLBACK` remains opt-in for development. The redesigned shop does not initialize production state from the demo catalogue.

## Validation gate

The stacked draft PR must pass:

- design-system contract check
- ESLint
- TypeScript
- Next.js production build
- backend Ruff and pytest
- Odoo addon installation and tests
- PostgreSQL migration replay
- development and production Docker Compose validation

## Manual acceptance matrix

- English + Light
- English + Dark
- Arabic + Light
- Arabic + Dark
- desktop header and mega menu
- mobile header and filter drawer
- live search suggestions
- query and category URLs
- brand, price, specification, and availability filters
- grid and list product views
- loading, empty, error, retry, and pagination states

## Deferred to PR-E

- product detail gallery and zoom
- product variants
- cart redesign
- checkout redesign
- account pages
- order tracking, returns, and warranty account workflows

## Branch strategy

This is a stacked branch based on `agent/stage2-design-system-i18n` because PR #21 was still queued in GitHub Actions when work began. After PR #21 is merged, this PR should be retargeted to `main` and updated if necessary before merge.
