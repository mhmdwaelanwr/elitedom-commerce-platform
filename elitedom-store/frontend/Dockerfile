# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEMO_CATALOG_FALLBACK=false
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG NEXT_PUBLIC_APPLE_CLIENT_ID=""
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL must be supplied at image build time." >&2; exit 1)
RUN test -n "$NEXT_PUBLIC_SITE_URL" || (echo "NEXT_PUBLIC_SITE_URL must be supplied at image build time." >&2; exit 1)
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_DEMO_CATALOG_FALLBACK=${NEXT_PUBLIC_DEMO_CATALOG_FALLBACK} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_APPLE_CLIENT_ID=${NEXT_PUBLIC_APPLE_CLIENT_ID}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat \
    && addgroup --system --gid 1001 nextjs \
    && adduser --system --uid 1001 --ingroup nextjs nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
