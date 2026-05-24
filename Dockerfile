# ───────── Frontend SPA build ─────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN npm install --no-audit --no-fund

COPY . .
# Build a plain SPA bundle (no SSR) for nginx.
RUN npx vite build --config vite.spa.config.ts

# ───────── Runtime: nginx serving static + /api proxy ─────────
FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist-spa/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
