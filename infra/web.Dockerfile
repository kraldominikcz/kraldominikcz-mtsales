# syntax=docker/dockerfile:1
# Webová verze aplikace (statický export Expo) + Caddy (HTTPS, reverzní proxy na API).
# Sestavení z kořene repozitáře: docker build -f infra/web.Dockerfile .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true EXPO_OFFLINE=1
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/app/package.json apps/app/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@mtsales/app..."
COPY packages packages
COPY apps/api apps/api
COPY apps/app apps/app
# API běží na stejné doméně (/api), proto prázdná EXPO_PUBLIC_API_URL
RUN EXPO_PUBLIC_API_URL= pnpm --filter @mtsales/app export:web

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/app/dist /srv
