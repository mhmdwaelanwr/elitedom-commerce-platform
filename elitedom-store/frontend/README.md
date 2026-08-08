# Elitedom Storefront and Admin

This directory is the canonical React 19 + TypeScript + Vite frontend for Elitedom. It contains customer storefront journeys and the staff administration/control-plane UI.

## Local development

```bash
npm install
VITE_API_URL=http://localhost:8000/api/v1 npm run dev
```

The development server listens on `http://localhost:3000` to preserve the existing backend CORS and local infrastructure contract.

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
├── pages/        Route-level React screens
├── components/   Reusable storefront/admin UI
├── lib/          Typed API/auth/catalog/session/preferences helpers
├── styles/       Global styles and design-system entry points
└── types/        Shared TypeScript/API types
```

`src/router.tsx` owns browser routing. `src/main.tsx` is the only DOM bootstrap entry point.

## Product guarantees

New UI must preserve:

- English and Arabic;
- LTR and RTL;
- light, dark and system theme preference;
- responsive mobile/tablet/desktop behavior;
- loading, empty, error and disabled states;
- keyboard/focus/accessibility behavior;
- server-authoritative money, stock, payment, permission and order state.

The browser must never contain private payment/Odoo/Twilio/email/database credentials. `VITE_*` values are public build-time browser configuration.

## Routing and SEO

React Router handles SPA routes such as `/`, `/admin/launch`, and future storefront/account routes. Production Nginx uses `try_files ... /index.html` so deep links resolve correctly.

`scripts/generate-seo.mjs` generates `public/robots.txt` and `public/sitemap.xml` from `VITE_SITE_URL` before development/build commands.

## Production build

Vite emits static assets to `dist/`. The Docker image serves them with unprivileged Nginx and SPA fallback; public API/site/media URLs are build inputs, so changing them requires rebuilding the frontend image.

```bash
cd ../infrastructure
docker compose --env-file ../.env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build frontend
```

Use a browser-reachable **HTTPS** API URL in production, not the internal Docker service hostname.
