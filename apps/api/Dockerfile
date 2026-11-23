# syntax=docker/dockerfile:1
# Sestavení z kořene repozitáře: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/app/package.json apps/app/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/

# Build (TypeScript → jeden balík, interní balíčky monorepa přibalené)
FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@mtsales/api..."
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @mtsales/api build
# Jen produkční závislosti API (bez Expo aplikace a vývojových nástrojů)
RUN pnpm --filter @mtsales/api deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY packages/db/migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Při startu nejdřív aplikuje migrace, pak spustí server.
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/index.js"]
