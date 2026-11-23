# mtSALES

Interní obchodní aplikace (lehké CRM) manageTOGETHER s.r.o. pro iOS a web.

- Specifikace: [docs/SPEC.md](docs/SPEC.md)
- Architektura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Backlog: [docs/BACKLOG.md](docs/BACKLOG.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Podklady: [podklady/](podklady/README.md)
- Pravidla pro vývoj s Claude Code: [CLAUDE.md](CLAUDE.md)

## Struktura

```
apps/app        Expo aplikace (iOS + web)
apps/api        API server (Fastify + tRPC)
packages/db     databázové schéma a migrace (Drizzle)
packages/domain business pravidla (pracovní kalendář, oprávnění, …)
packages/shared sdílené typy, validace, české texty
infra/          Docker Compose, Caddy
```

## Spuštění – varianta A: celá aplikace v Dockeru (nejjednodušší)

Potřebuješ jen **Docker Desktop** (nebo OrbStack) na Macu.

```bash
git clone <repozitář> mtsales && cd mtsales
cp .env.example .env
# v .env vyplň:
#   JWT_SECRET          → výstup příkazu: openssl rand -base64 48
#   APP_ENCRYPTION_KEY  → výstup příkazu: openssl rand -base64 32
#   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME → tvůj e-mail a jméno (první manažer)

docker compose -f infra/docker-compose.yml --profile app up -d --build
docker compose -f infra/docker-compose.yml exec api node dist/scripts/seed.js
```

Poslední příkaz vypíše **dočasné heslo**. Otevři <http://localhost:8080> a přihlas se.

## Spuštění – varianta B: vývojový režim (web + iPhone přes Expo Go)

Potřebuješ Node.js 22, pnpm (`corepack enable`) a Docker.

```bash
pnpm install
cp .env.example .env                     # vyplň jako výše
cp apps/app/.env.example apps/app/.env   # adresa API pro aplikaci
docker compose -f infra/docker-compose.yml up -d postgres
pnpm db:migrate
pnpm db:seed                             # vypíše dočasné heslo

pnpm dev:api                             # terminál 1 – API na portu 3000
pnpm dev:app                             # terminál 2 – Expo: „w“ otevře web
```

**iPhone:** nainstaluj z App Store aplikaci **Expo Go**, v `apps/app/.env` nastav
`EXPO_PUBLIC_API_URL=http://<IP-adresa-Macu>:3000` a naskenuj QR kód z terminálu fotoaparátem iPhonu.
iPhone a Mac musí být ve stejné Wi-Fi. (IP adresu Macu najdeš v Nastavení → Wi-Fi → Podrobnosti.)

## Kontroly

```bash
pnpm typecheck   # typy ve všech balíčcích
pnpm test        # testy (potřebují běžící PostgreSQL s databází mtsales_test)
```
