# CLAUDE.md – pravidla projektu mtSALES

Interní obchodní aplikace (lehké CRM) manageTOGETHER s.r.o. pro iOS a web. Uživatelé: 8 lidí, rozhraní česky.

## Zdroj pravdy
- `docs/SPEC.md` – co se staví (živý dokument). `docs/ARCHITECTURE.md` – jak (včetně ADR logu na konci).
- `docs/BACKLOG.md` – nezařazené nápady s prioritou. `docs/CHANGELOG.md` – změny po verzích.
- `podklady/` – podklady od zadavatele (ceníky, vzory, provize, loga). Jen čti, neměň.

## Řízení změn (povinné)
1. Nová funkce nebo změna od zadavatele → **nejdřív** zapiš do `docs/SPEC.md` (a historie změn na konci).
2. Popiš dopad: databáze, ostatní moduly, odhad práce.
3. **Počkej na OK zadavatele**, teprve pak programuj.
4. Co nepatří do aktuální fáze → `docs/BACKLOG.md` s prioritou.
5. Každá dokončená změna → záznam v `docs/CHANGELOG.md` (sekce `[Unreleased]`, při vydání verze).
6. Vývoj po fázích a krocích (viz SPEC 8 a ARCHITECTURE 12). Po každém kroku se zastav, shrň, co je hotové,
   a napiš, **jak to zadavatel otestuje** (konkrétní kroky).

## Struktura a modularita
- Monorepo pnpm + Turborepo: `apps/app` (Expo iOS + web), `apps/api` (Fastify + tRPC), `apps/ai-worker`,
  `packages/db` (Drizzle schéma + migrace), `packages/domain` (čistá business logika), `packages/shared`
  (Zod schémata, typy, české texty), `packages/integrations` (adaptéry).
- Každá oblast je **samostatný modul** (`apps/api/src/modules/<modul>/`, `packages/db/src/schema/<modul>.ts`).
  Modul sahá jen na svoje tabulky; jiné moduly volá přes jejich `service` nebo události.
- Externí systémy jen přes **adaptéry s rozhraním** (CRM, e-podpis, e-mail, vytěžování, WhatsApp/SMS).
- Business pravidla patří do `packages/domain` jako čisté funkce bez I/O (snadno testovatelné).

## Databáze
- Změny schématu **vždy přes migraci** (`pnpm db:generate` → SQL v `packages/db/migrations`, commitovat).
- **Nikdy neztrať data:** žádné `DROP`/přejmenování bez převodu dat; destruktivní změny ve dvou krocích
  (přidat nové → převést → odebrat staré v pozdější verzi). Vygenerované SQL vždy zkontroluj.
- Peníze v haléřích (`bigint`), časy v UTC (`timestamptz`), zobrazení Europe/Prague.

## Bezpečnost a GDPR
- **Žádné osobní údaje v logech** (jména, e-maily, telefony, IČO osob). Loguj jen ID. Pino má redakci, nevypínat.
- Každé API volání kontroluje oprávnění (RBAC) – nikdy jen v UI.
- Čtení detailu firmy/kontaktu/dokumentu a všechny změny → `audit_events`.
- Tajné údaje (tokeny, API klíče, hesla) **nikdy** v kódu, v repozitáři ani v chatu. Jen v proměnných prostředí;
  `.env` je v `.gitignore`, vzor v `.env.example`.
- Do `podklady/` ani do testů nepatří reálné osobní údaje zákazníků.

## Kód
- TypeScript `strict`, žádné `any` bez důvodu. Validace vstupů Zod schématy ze `packages/shared`.
- Identifikátory v kódu anglicky; texty pro uživatele česky v `packages/shared/src/i18n/cs.ts`.
- Kalendář pracovních dnů ČR (`packages/domain` → `workCalendar`) používej pro vše časové: eskalace,
  přehledy, notifikace. O víkendech a svátcích se nic neposílá.

## Testy
- Ke klíčové logice vždy testy (Vitest): `packages/domain` (pravidla), API (oprávnění, auth, migrace).
- Integrační testy API běží proti reálnému PostgreSQL (`DATABASE_URL_TEST`).
- Před commitem: `pnpm typecheck && pnpm test`.

## Prostředí
- Expo SDK 58, React Native 0.88, React 19, TypeScript 6 (výchozí `types` je prázdné → `"types": ["node"]` v tsconfig).
- Verze Expo balíčků ber z `node_modules/expo/bundledNativeModules.json` (`npx expo install` potřebuje servery Expo).
- Trasy aplikace jsou v `apps/app/src/app/` (Expo Router), ostatní kód mimo tuto složku.

## Git
- Malé commity s jasným popisem v češtině, prefix podle typu: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Vývojová větev: `claude/mtsales-app-setup-zwh5ok`. Pull request jen na výslovnou žádost.

## Příkazy
```bash
pnpm install                 # závislosti
docker compose -f infra/docker-compose.yml up -d postgres   # PostgreSQL pro vývoj (+ testovací DB)
pnpm db:migrate              # aplikovat migrace
pnpm db:seed                 # první manažerský účet (viz .env.example)
pnpm dev:api                 # API (port 3000)
pnpm dev:app                 # Expo (w = web, QR = iPhone v Expo Go)
pnpm typecheck && pnpm test  # kontrola
```
