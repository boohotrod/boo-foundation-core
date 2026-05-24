# ───────── Frontend build ─────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
RUN corepack enable && npm install --no-audit --no-fund

# Build static frontend
COPY . .
RUN npm run build

# ───────── Runtime: nginx serving static + /api proxy ─────────
FROM nginx:1.27-alpine AS runtime

# TanStack Start emits client assets to .output/public when targeting node/cloudflare;
# fall back to dist/ for plain SPA builds.
COPY --from=build /app/.output/public /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
