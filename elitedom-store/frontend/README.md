# Elitedom Storefront and Admin

This directory is the canonical Next.js 16.2 / React 19.2 frontend for Elitedom. It contains customer storefront journeys and the staff administration/control-plane UI.

## Local development

```bash
npm ci
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

Quality gates:

```bash
npm run check:design-system
npm run lint
npm run check:types
npm run build
```

## Source organization

```text
src/
├── app/          Routes, layouts, SEO routes and route composition
├── components/   Reusable storefront/admin UI
├── lib/          Typed API/auth/catalog/session/preferences helpers
└── types/        Shared TypeScript/API types
```

## Product guarantees

New UI must preserve:

- English and Arabic;
- LTR and RTL;
- light, dark and system theme preference;
- responsive mobile/tablet/desktop behavior;
- loading, empty, error and disabled states;
- keyboard/focus/accessibility behavior;
- server-authoritative money, stock, payment, permission and order state.

The browser must never contain private Paymob/Odoo/Twilio/email/database credentials. `NEXT_PUBLIC_*` values are browser-visible by design.

## Main journeys

The current App Router includes storefront discovery/product/shop, cart, checkout, account, B2B and staff administration paths, plus authentication/MFA and SEO assets (`robots.ts`, `sitemap.ts`). Staff launch controls live under the admin application and rely on backend permissions/MFA.

## Production build

The Dockerfile uses Next.js standalone output and a non-root runtime. Public API/site/media URLs are build inputs; changing them requires rebuilding the frontend image.

```bash
cd ../infrastructure
docker compose --env-file ../.env   -f docker-compose.yml   -f docker-compose.prod.yml   up -d --build frontend
```

Use a browser-reachable **HTTPS** API URL in production, not the internal Docker service hostname.

## Assets

Retained visual assets under `public/template/images` are referenced by the active UI and local seed/catalog paths. Production usage rights remain a commercial/legal launch item; repository inclusion is not a license grant.
