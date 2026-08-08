# Elitedom Storefront Design System — Google Store Direction

This document is the canonical visual reference for the Elitedom storefront redesign. It supersedes previous Stage 10.5/10.6 visual directions while preserving the existing product, cart, checkout, auth, Paymob, Odoo and API behavior.

## Brand identity

- Aesthetic: clean, minimalist, premium, high-contrast and product-focused.
- Layout principle: flat surfaces, ample whitespace and rounded interactive containers.
- Product imagery must carry more visual weight than decorative UI.
- Avoid gradients, glass effects, glow, ornamental blobs, harsh shadows and excessive card nesting.

## Light theme palette

| Token | Value | Usage |
| --- | --- | --- |
| `background-primary` | `#FFFFFF` | Core page backgrounds and main sheets |
| `background-secondary` | `#F8F9FA` | Product grids, category cards and subtle sectioning |
| `text-primary` | `#202124` | Headlines, body emphasis and product titles |
| `text-secondary` | `#5F6368` | Subtitles, specs and helper copy |
| `google-blue` | `#4285F4` | Primary CTAs and focus links |
| `google-blue-hover` | `#1A73E8` | Primary CTA hover |
| `google-red` | `#EA4335` | Sale, destructive and alert states |
| `google-yellow` | `#FBBC05` | Ratings and promotional emphasis |
| `google-green` | `#34A853` | In-stock and success states |
| `border-light` | `#DADCE0` | Dividers and subtle borders |

The project retains a semantic dark mode derived from this palette because light/dark/system support is a platform requirement.

## Typography

- Primary stack: `Google Sans`, `Roboto`, sans-serif.
- Headlines: bold, sentence case, `#202124`, tight but readable tracking.
- Body: regular weight, `#5F6368`, line-height 1.5.
- The application may fall back to Roboto/system fonts when Google Sans is not locally available; do not bundle unlicensed font files.

## Navigation

- Height: 64px fixed/sticky shell.
- Background: solid primary background.
- Bottom border: 1px `#DADCE0`.
- Desktop layout: brand left, category navigation centered, search/account/cart utilities right.
- Search opens as a focused secondary surface rather than permanently consuming the navigation bar.

## Buttons

### Primary
- Pill shape, 24px radius.
- `#4285F4` background.
- White text.
- No border.
- Hover: `#1A73E8`.

### Secondary
- Transparent background.
- 1px `#DADCE0` border.
- `#4285F4` text.
- Subtle blue tonal hover only.

## Product cards

- Vertical product-first anatomy.
- `#F8F9FA` background.
- 24px internal padding.
- 16px radius.
- No harsh drop shadow.
- Content order:
  1. Minimal product/status tag.
  2. Centered product image on a clean primary surface.
  3. Brand/title.
  4. Only the amount of technical information required for the context.
  5. Price and baseline CTA.
- Homepage cards remain minimal; catalogue cards can expose the most decision-driving technical values.

## Product detail

- Above the fold: gallery, brand/title, short description, up to four key specs, price, stock and purchase actions.
- Full technical data moves below the fold.
- Overview, technical details and warranty/support are separated using tabs.
- Specification data remains sourced from structured backend `product.specs[]`.

## Grid

- Global max width: 1280px.
- Global horizontal gutter: 24px desktop/tablet, 16px compact mobile.
- Product grids: 4 columns desktop, 2 columns tablet, 1 column compact mobile when card width would otherwise become unusable.

## Accessibility and localization

- Preserve EN/AR and true LTR/RTL.
- Preserve light/dark/system themes.
- Preserve focus-visible treatment and keyboard navigation.
- Interactive target sizes should normally be at least 40–48px.
- Motion must be restrained and respect `prefers-reduced-motion`.

## Functional constraints

The redesign is presentation-layer work. It must not change the established contracts for FastAPI, PostgreSQL, Redis, Odoo, Paymob, cart, checkout, authentication, inventory, fulfillment, wishlist or account behavior without a separate engineering decision.