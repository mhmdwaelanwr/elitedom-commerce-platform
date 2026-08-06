# Elitedom Storefront

This directory is the canonical Next.js 16 storefront and administration application for Elitedom. It uses React 19, TypeScript, Tailwind CSS 4, and the FastAPI service under `../backend`.

## Run locally

```bash
npm ci
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

If `NEXT_PUBLIC_API_URL` is omitted in development, the client defaults to `http://localhost:8000/api/v1`.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Production container

The multi-stage `Dockerfile` uses Next.js standalone output. The final image contains the traced runtime, static files, and public assets, and runs as the unprivileged `nextjs` user.

`NEXT_PUBLIC_API_URL` is a build-time public browser value. It must point to the customer-visible HTTPS API address, not the internal Docker hostname. Rebuild the frontend image after changing it.

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.store.example.com/api/v1 \
  -t elitedom-storefront:local \
  .
```

To run it through the repository Compose files:

```bash
cd ../infrastructure
docker compose --env-file ../.env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build frontend
```

## Source organization

```text
src/
├── app/          Next.js routes, layouts and route-level composition
├── components/   Reusable storefront and administration components
├── lib/          API adapter, domain helpers, catalogue and session utilities
└── types/        Shared TypeScript domain and API types
```

Route components should compose existing services and UI components rather than duplicate request, pricing, session, or mapping logic. New provider integrations belong in the backend and must be exposed through typed API adapters.

## Current flows

- Responsive landing, catalogue, search, filtering and product detail pages.
- Guest and authenticated carts with safe guest-to-account merging.
- Checkout, account, saved addresses, orders, B2B RFQ, warranty and RMA journeys.
- Staff catalogue, product media, inventory and administration screens.

The main API adapter is `src/lib/api.ts`. Production pages must use live API data. The optional development catalogue fallback is controlled by `NEXT_PUBLIC_DEMO_CATALOG_FALLBACK` and stays disabled by default.

## Vendored visual assets

Visual assets required by the current storefront are self-contained under `public/template/images`. The standalone reference application that originally accompanied those assets was removed during Stage 1 because it was not part of the build, tests, Docker topology, or runtime dependency graph.

The retained assets are referenced by the active storefront and local development seed data. Their origin and production usage rights must be reviewed before public launch; removing the unused source application does not itself grant asset rights.
