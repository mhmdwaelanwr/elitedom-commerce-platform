# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_API_URL
ARG VITE_SITE_URL=http://localhost:3000
ARG VITE_MEDIA_URL=""
ARG VITE_DEMO_CATALOG_FALLBACK=false
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_APPLE_CLIENT_ID=""
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL must be supplied at image build time." >&2; exit 1)
RUN test -n "$VITE_SITE_URL" || (echo "VITE_SITE_URL must be supplied at image build time." >&2; exit 1)
ENV NODE_ENV=production \
    VITE_API_URL=${VITE_API_URL} \
    VITE_SITE_URL=${VITE_SITE_URL} \
    VITE_MEDIA_URL=${VITE_MEDIA_URL} \
    VITE_DEMO_CATALOG_FALLBACK=${VITE_DEMO_CATALOG_FALLBACK} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} \
    VITE_APPLE_CLIENT_ID=${VITE_APPLE_CLIENT_ID}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
