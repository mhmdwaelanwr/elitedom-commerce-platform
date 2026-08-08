# Elitedom Hardware UX — Progressive Disclosure

This document is the implementation rule for the storefront redesign.

## 1. Store shell and homepage — Minimal

The homepage is orientation, not specification comparison.

- Search, departments, campaigns and trust are primary.
- Product cards may expose at most one useful technical value.
- No specification tables, dense badges or long feature lists on the homepage.
- Product imagery and category recognition get more visual weight than metadata.

## 2. Catalogue and search — Semi-technical

The catalogue supports fast comparison without becoming a spec sheet.

- Product cards expose up to four decision-driving specifications.
- Specs are presented as label/value pairs, not decorative chip clouds.
- Availability, price and brand filters are immediately visible.
- Technical specification filters are a second disclosure layer and may expand on demand.
- List mode can expose the product description; grid mode stays denser and scan-friendly.

## 3. Product detail — Technical depth

The PDP has two information layers.

### Above the fold

- Product gallery
- Brand / SKU / rating
- Product name
- Short description
- Four key specifications
- Price and availability
- Quantity, Add to cart, Buy now, Wishlist
- Compact fulfilment / warranty / payment trust facts

### Below the fold

- Product overview / long description
- Full technical specification table
- Warranty, fulfilment and payment/support information
- Related products

Technical depth must never compete visually with the initial purchase decision.

## 4. Key-spec selection

When the backend provides many specs, prefer decision-driving values first:

1. CPU / processor / chipset
2. GPU / graphics
3. RAM / memory
4. Storage / SSD / capacity
5. Display / resolution / refresh rate
6. Socket / chipset / power, depending on category
7. Remaining specs in backend order

The backend remains the source of truth. The frontend only controls disclosure and ordering.

## 5. Visual rules

- Calm graphite/neutral base with cobalt as the primary accent.
- Product canvases remain quiet and neutral.
- Moderate radii, subtle borders, restrained shadows.
- No decorative glassmorphism, neon glow, oversized marketing type or UI noise.
- Keep EN/AR, RTL/LTR, light/dark/system, accessibility and responsive behavior intact.

## 6. Contract rule

This redesign must not change FastAPI, Odoo, Paymob, cart, authentication, inventory or order contracts. It changes information hierarchy and presentation only.
