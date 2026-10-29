# syntax=docker/dockerfile:1
# 1) Build: Next.js genera el export estático en /app/out
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run validate && npm run build

# 2) Runtime: un Caddy mínimo, sin root, sirviendo los archivos tal cual
FROM caddy:2-alpine
ENV XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp
COPY Caddyfile.static /etc/caddy/Caddyfile
COPY --from=build /app/out /srv
USER nobody
EXPOSE 8080
