# syntax=docker/dockerfile:1

# Keep the runtime small by using Next.js standalone output instead of copying
# the complete development node_modules tree into the final image.
FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder

# NEXT_PUBLIC_* values are compiled into browser JavaScript. Supply a
# browser-reachable API URL at image-build time (never a Docker-only hostname).
ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL must be supplied at image build time." >&2; exit 1)
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

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

# Next standalone does not copy these static assets automatically.
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
