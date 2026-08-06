# Elitedom Storefront

The Next.js 16 storefront for Elitedom. It uses the project’s existing Tailwind 4 setup and FastAPI API rather than the static data and Redux layer supplied by the imported ecommerce template.

## Run locally

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

If `NEXT_PUBLIC_API_URL` is omitted, the storefront uses `http://localhost:8000/api/v1` by default.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Production container

The storefront has a multi-stage `Dockerfile` that uses Next.js standalone output. The final image contains only the traced runtime, static files, and `public` assets, and it runs as an unprivileged `nextjs` user.

`NEXT_PUBLIC_API_URL` is intentionally a **build-time** value because it is used by browser code. It must point to the customer-visible HTTPS API address, for example `https://api.store.example.com/api/v1`; do not use Docker's `http://fastapi:8000` hostname. Rebuild the image after changing it.

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.store.example.com/api/v1 \
  -t elitedom-storefront:local \
  .

docker run --rm -p 127.0.0.1:3000:3000 elitedom-storefront:local
```

To run the production storefront through the repository Compose files, set `NEXT_PUBLIC_API_URL` and `FRONTEND_PORT` in the root `.env`, then run:

```bash
cd ../infrastructure
docker compose --env-file ../.env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build frontend
```

The production overlay intentionally fails if `NEXT_PUBLIC_API_URL` is missing. The Compose service binds port 3000 to loopback only. Configure Nginx Proxy Manager to forward the public storefront domain to `frontend:3000` on the `elitedom-net` network and terminate TLS there.

## Implemented storefront flows

- Responsive landing experience built from the imported template assets: department discovery, featured picks, curated collection promos, and B2B/warranty journeys.
- Product catalogue with header search suggestions, keyword/specification matching, department, brand, price, availability and technical-specification filters, sort options, and grid/list views.
- Product detail pages with image gallery, specifications, warranty/fulfilment information, wishlisting, add-to-cart, and direct buy-now checkout actions.
- Guest and authenticated carts that synchronize with the FastAPI service, including safe guest-to-account cart merging.
- Guest checkout with contact validation, registered checkout, saved-address selection, governorate-based VAT/shipping estimates, and Stripe-hosted redirect when card payment is configured.
- Registration, sign-in, session-aware account summary, profile editing, multiple saved delivery addresses, recent orders, and loyalty balance.
- B2B RFQ form plus warranty/RMA lookup, claim submission with required evidence, and recent-claim tracking.

The API adapter is in `src/lib/api.ts`. It deliberately maps the API DTOs to the UI model, so the UI remains usable with the fallback catalogue while a local API has no catalog records yet.

## Imported template assets

The visual assets from `../nextjs-ecommerce-template-main/public/images` are copied into `public/template/images`. They are used by the Elitedom-specific pages and components; no Tailwind 3 configuration, template Redux state, static orders, or static checkout behavior was copied.

Review the upstream template’s licence and asset rights before a production release.
