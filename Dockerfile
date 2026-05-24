# ───────── Frontend build ─────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
RUN corepack enable && npm install --no-audit --no-fund

# Build static frontend
COPY . .
RUN npm run build
# TanStack Start is SSR by default; synthesize a static index.html for nginx.
RUN node docker/generate-index.mjs dist/client

# ───────── Runtime: nginx serving static + /api proxy ─────────
FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/client/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
