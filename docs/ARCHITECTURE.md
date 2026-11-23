# mtSALES – architektura

> Stav: **NÁVRH – čeká na schválení.** Po schválení se změny architektury zapisují sem
> a do sekce „Rozhodnutí“ na konci (ADR log).

## 1. Přehled

```
                ┌────────────────────── Cloud EU (Hetzner, DE) ───────────────────────┐
 iPhone app ──┐ │  Caddy (HTTPS, Let's Encrypt)                                        │
 (Expo, iOS)  ├─┼─▶ /        → web aplikace (statický export Expo web)                 │
 Prohlížeč ───┘ │    /api     → API server (Node.js, Fastify + tRPC)                   │
                │    /hooks   → webhooky (Microsoft Graph, DocuSign, …)                │
                │                                                                      │
                │  Job worker (pg-boss: plánované úlohy, notifikace, eskalace)         │
                │  PostgreSQL 16  ── WAL archiv ─▶ Object Storage (jiná lokalita)      │
                │  Gotenberg (HTML → PDF nabídek)                                      │
                │  Dokumenty ─────────────────▶ Object Storage (S3, šifrováno)         │
                └───────────────▲───────────────────────────────▲──────────────────────┘
                                │ odchozí HTTPS (jen z Mac Mini)  │ odchozí HTTPS
                ┌───────────────┴──────── Mac Mini M4 (kancelář) ┴──────────────────────┐
                │  ai-worker: stáhne úlohu → OCR + lokální LLM (Ollama) → vrátí JSON     │
                │  backup-puller: každou noc stáhne šifrované zálohy DB + dokumentů      │
                └────────────────────────────────────────────────────────────────────────┘
 Externí služby: ARES (IČO), Microsoft Graph (přihlášení, e-mail), Expo Push / APNs,
                 Web Push, DocuSign (volitelně), CRM adaptér (volitelně)
```

**Klíčová vlastnost:** Mac Mini nemá **žádný otevřený port** do internetu. Vše iniciuje sám
odchozím spojením, takže nepotřebujeme ani Cloudflare Tunnel. Když je Mac Mini vypnutý,
aplikace běží dál, jen vytěžování čeká ve frontě.

## 2. Technologie a zdůvodnění

| Oblast | Volba | Proč |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | rychlé, sdílené typy mezi appkou a API, cache buildů |
| Jazyk | **TypeScript** (strict) všude | jeden jazyk, typová kontrola napříč klientem i serverem |
| Klient | **Expo SDK + Expo Router** (iOS + web z jednoho kódu) | dle zadání; nativní moduly přes Expo Modules API |
| UI | React Native + **Tamagui** nebo **NativeWind** (rozhodnu v 1. fázi prototypem) | sdílené komponenty pro iOS i web, responzivní |
| Data na klientu | **TanStack Query** + tRPC klient | cache, offline-tolerantní čtení, automatické obnovování |
| API | **Fastify + tRPC**, validace **Zod** | end-to-end typy bez generování kódu; Fastify pro REST webhooky |
| DB | **PostgreSQL 16** | relační data, fulltext, JSONB pro vytěžená data |
| ORM / migrace | **Drizzle ORM + drizzle-kit** (SQL migrace v gitu) | migrace jsou čitelné SQL soubory, žádná „magie“, snadná revize |
| Fronta / plánovač | **pg-boss** (nad PostgreSQL) | žádný Redis navíc; cron v časové zóně Europe/Prague, retry, deduplikace |
| PDF | **Gotenberg** (Chromium v kontejneru), šablony v HTML/React | přesné PDF s logem, TV stránka jako komponenta |
| Soubory | **S3-kompatibilní úložiště** (Hetzner Object Storage; lokálně MinIO) | levné, oddělené od serveru, šifrování na straně serveru |
| Fulltext | PostgreSQL FTS (`unaccent` + `simple`) + `pg_trgm` | čeština bez diakritiky, překlepy; pro 8 uživatelů bohatě stačí |
| E-mail | **Microsoft Graph API** | posílání ze schránky obchodníka, zachytávání odpovědí webhookem |
| Push | **Expo Push** (iOS), **Web Push / VAPID** (web), e-mail přes Graph | dle zadání, jeden modul `notifications` se 3 kanály |
| Lokální AI | **Ollama** nativně na macOS (Metal GPU) + OCR (Tesseract `ces` / Apple Vision) | Docker na macOS nemá přístup ke GPU, proto AI běží mimo Docker |
| Logy | **pino** s redakcí osobních údajů | v logu jen ID, nikdy jména/čísla/e-maily |
| Testy | **Vitest** (logika + API proti reálnému Postgres v Dockeru), Playwright (web e2e) | |
| CI | **GitHub Actions**: lint, typecheck, testy, kontrola migrací | |
| iOS build | **EAS Build + TestFlight** | dle zadání |

Odchylky od zadání: žádné zásadní. Přidávám pg-boss (místo Redis/BullMQ, o jednu službu méně)
a Gotenberg pro PDF.

## 3. Struktura repozitáře

```
apps/
  app/                 Expo aplikace (iOS + web), Expo Router
    app/               obrazovky (routy) – (auth), (tabs)/muj-den, zakaznici, pipeline, ukoly, …
    modules/           UI po modulech (customers, pipeline, calls, …)
    native/call-observer/  Expo modul ve Swiftu (CXCallObserver), na webu prázdná implementace
  api/                 Fastify + tRPC server
    src/modules/<modul>/   router.ts, service.ts, repo.ts, jobs.ts, events.ts, *.test.ts
  ai-worker/           běží na Mac Mini: stahuje úlohy vytěžování, volá Ollama, vrací výsledek
packages/
  db/                  Drizzle schéma (soubor na modul) + SQL migrace + seed
  domain/              čistá business logika bez I/O (pravidla fází, další krok, skóre disciplíny,
                       retenční termíny, upsell, provize, kalkulačka) – nejvíc testů
  shared/              Zod schémata, typy, české texty (cs.ts), formátování (Kč, data)
  integrations/        ares, msgraph, docusign, crm-adapter (rozhraní + implementace)
infra/
  docker-compose.yml        lokální vývoj (postgres, minio, mailpit, gotenberg)
  docker-compose.prod.yml   produkce (caddy, api, worker, postgres, gotenberg)
  backup/                   skripty záloh a testu obnovy
  macmini/                  instalace ai-workeru a backup-pulleru (launchd)
podklady/              podklady od zadavatele (ceníky, vzory, loga…)
docs/                  SPEC, ARCHITECTURE, BACKLOG, CHANGELOG
```

## 4. Modularita

Každý modul (oblast ze SPEC) je samostatný celek:

| Modul | Fáze | Vlastní tabulky (zkráceně) |
|---|---|---|
| `auth`, `users` | 1 | users, user_roles, sessions, devices |
| `customers` | 1 | companies, contacts, company_persons (ARES), company_links |
| `services` | 1 | services (SIM/číslo, internet, TV, ostatní), competitor_offers |
| `pipeline` | 1 | pipelines, stages, deals, deal_items, deal_stage_history |
| `activities` | 1 | activities (hovor, e-mail, schůzka, poznámka, systémová) |
| `calls` | 1 | call_attempts (stav „čeká na zápis“) |
| `tasks` | 1 | tasks, task_escalations |
| `discipline` | 1 | activity_targets, discipline_scores (denní snímky) |
| `notifications` | 1 | notifications, push_tokens, notification_prefs, digest_runs (ranní/večerní přehledy) |
| `audit`, `gdpr` | 1 | audit_events |
| `retention` | 2 | (úlohy nad services + tasks), upsell_rules |
| `catalog` | 1/3 | price_lists (verze), products, tv_packages, tv_channels |
| `email` | 3 | mailboxes, email_messages, email_templates |
| `automations` | 3 | sequences, sequence_steps, sequence_enrollments, customer_reminders, opt_outs |
| `offers` | 3 | offers, offer_versions, offer_items, signatures |
| `documents`, `extraction` | 4 | documents, document_text, extraction_jobs, extraction_results |
| `calculator` | 4 | comparisons, comparison_lines |
| `commissions` | 5 | commission_rule_sets (verze), commissions |
| `reports` | 5 | (čte přes pohledy / views), report_schedules |
| `backoffice` | 6 | bo_tasks, bo_comments, porting_requests |

Pravidla:
- Modul **sahá jen na svoje tabulky**. Data jiného modulu čte přes jeho `service`, reaguje na jeho **události**
  (interní event bus, např. `deal.stageChanged`, `call.logged`, `service.commitmentSet`).
- Nový modul = nová složka v `api/src/modules`, `db/schema`, `app/modules` + migrace. Ostatní moduly se nemění.
- Externí systémy jen přes **adaptéry** s rozhraním (`CrmAdapter`, `ESignAdapter`, `MailProvider`, `ExtractionEngine`).

## 5. Datový model – jádro (fáze 1)

- **Peníze** v haléřích (`bigint`), ceny B2B bez DPH, sazba DPH zvlášť. **Časy** v UTC, zobrazení Europe/Prague.
- `companies`: ico (unikátní), dic, název, právní forma, adresa (strukturovaná), CZ-NACE kódy, owner_id,
  ares_synced_at. Statutáři z ARES jdou do `company_persons`.
- `company_links`: vypočtená propojení (typ: obor / adresa / osoba / e-mailová doména / skupina, síla, zdroj).
  Přepočítává se úlohou po změně firmy nebo kontaktu.
- `services`: company_id, typ, telefonní číslo / ICCID, tarif, uživatel, měsíční cena, operátor,
  konec závazku, zdroj (ručně / vytěženo z dokumentu X).
- `deals`: company, owner, stage, hodnota, očekávané uzavření, lost_reason, `next_task_id` (udržuje doména).
- `activities`: typ, user, company, deal?, contact?, occurred_at, délka, výsledek, poznámka.
- `tasks`: title, due_at, assignee, company?/deal?, typ (ruční / retence / systém / backoffice), stav,
  escalated_at.
- `audit_events`: kdo, kdy, entita, akce (**view**/create/update/delete/export), změněná pole.

### Klíčová pravidla v `packages/domain` (čisté funkce, unit testy)
- `canMoveToStage(deal, activities, targetStage)` – zapsaná aktivita od posledního posunu, důvod u prohry.
- `requiresNextStep(deal, tasks)` – otevřený obchod bez budoucího úkolu.
- `workCalendar` – pracovní dny ČR: víkendy + státní svátky včetně Velkého pátku a Velikonočního pondělí
  (počítané z data Velikonoc). Používají ho eskalace, přehledy, notifikace i automatiky.
- `escalationDue(task, now, calendar)` – 2 **pracovní** dny po termínu.
- `canNotify(now, calendar)` – o víkendech a svátcích se neposílá nic; zákazníkům jen v pracovní době 8–17 h.
- `disciplineScore(inputs)` – skóre 0–100 dle SPEC 6.4.1.
- `retentionTaskDates(commitmentEnd)` – −6 / −3 / −1 měsíc (fáze 2).
- `upsellHints(services)` – fáze 2. `commission(...)` – fáze 5 podle Excelu.

## 6. Přihlášení a bezpečnost

**Vlastní přihlášení pro všechny** (M365 nemají všichni, Q14):
- E-mail + heslo (argon2id) + **TOTP kód z Microsoft Authenticator** (povinný pro všechny). Při aktivaci účtu
  uživatel naskenuje QR kód a dostane záložní jednorázové kódy.
- Ochrana: omezení počtu pokusů, zablokování účtu manažerem, odhlášení všech zařízení.
- **M365 se připojuje zvlášť** (ve fázi 3): obchodník jednou klikne „Připojit Outlook“ a aplikace získá oprávnění
  k jeho schránce a kalendáři přes Graph API. Přihlášení do aplikace na M365 nezávisí.
- **iPhone:** po prvním přihlášení se obnovovací token uloží do Keychain (`expo-secure-store`) a odemyká se
  **Face ID** (`expo-local-authentication`). Přístupový token je krátkodobý (15 min).
- **Role a oprávnění:** RBAC v API. Každá procedura deklaruje oprávnění a filtr dat (vlastní / všechny /
  omezený pohled na cizí firmu dle SPEC 5.1). Testováno.
- **Šifrování:** TLS všude; šifrovaný disk na Mac Mini (FileVault); dokumenty v S3 šifrované;
  zálohy šifrované (restic, AES-256) ještě před odesláním.
- **Audit log:** zápis i čtení detailu firmy/kontaktu/dokumentu. Manažer má v aplikaci přehled.
- **GDPR:** export údajů osoby (JSON + PDF); výmaz = anonymizace kontaktu a jeho aktivit.
  Dokumenty, kde osoba figuruje, se označí k ručnímu posouzení. Logy aplikace bez osobních údajů (redakce v pino).
- **Data v EU:** server i úložiště v Hetzner DE/FI, M365 tenant v EU, Expo Push přenáší jen text notifikace
  (bez osobních údajů, např. „Máš 3 úkoly po termínu“).

## 7. Volání (fáze 1)

1. Klik na číslo → API založí `call_attempt` (kdo, komu, kdy, stav `pending_log`) → otevře se `tel:`.
2. Současně se naplánuje lokální notifikace za 15 min („Zapiš hovor s …“). Server má pojistku: nezapsané
   pokusy se objeví v připomínce v 16:30 a ve skóre disciplíny.
3. Návrat do aplikace (`AppState` → active) → hned formulář: výsledek, poznámka, další krok, posun fáze.
4. **iOS délka hovoru:** vlastní Expo modul (Swift, `CXCallObserver`). Jde to, ale jen v **dev buildu / EAS
   buildu**, ne v Expo Go. Délku zachytí, pokud aplikace běží v pozadí. Když ji iOS mezitím ukončí,
   délka se nevyplní a obchodník ji zadá ručně. Výpis hovorů ani nahrávání se nedělá (iOS to nedovoluje).
5. Web: `tel:` + ruční zápis.

## 8. E-mail přes Microsoft 365 (fáze 3)

- Odeslání: Graph `sendMail` jménem přihlášeného obchodníka (delegované oprávnění `Mail.Send`).
  Do e-mailu se přidá interní hlavička `X-mtSALES-Ref: <id nabídky>`.
- Příjem: Graph **change notifications** na schránku obchodníka → webhook `/hooks/msgraph` → stáhne zprávu
  → spáruje podle `conversationId` / hlavičky / e-mailu kontaktu → uloží do historie a upozorní obchodníka.
- Pojistka: noční synchronizace (delta query), kdyby webhook vypadl.
- **Kalendář:** naplánovaný hovor/schůzka se zákazníkem = událost v kalendáři obchodníka přes Graph
  (`Calendars.ReadWrite`), zákazník dostane standardní pozvánku.
- **Automatiky (modul `automations`):** sekvence follow-upů běží jako plánované úlohy v pg-boss. Každý krok
  před odesláním ověří: přišla odpověď? změnil se stav nabídky? je pracovní den a pracovní doba? je kontakt odhlášený?
- **Systémové e-maily** (přehledy, upozornění) ze sdílené schránky `mtsales@<doména>` (bez licence).
- Limity M365 (cca 10 000 příjemců/den a 30 zpráv/min na schránku) jsou pro 8 lidí s velkou rezervou.
- **SMS (volitelně, Q23):** adaptér `SmsProvider` pro českou SMS bránu.
- Licence pro lidi bez schránky: Business Basic nebo Exchange Online Plan 1. Pro aplikaci stačí obojí.
- Sledování otevření (volitelně): odkaz na nabídku přes aplikaci místo přílohy → záznam o otevření.

## 9. Lokální AI na Mac Mini (fáze 4)

- `ai-worker` (Node.js, launchd služba) se odchozím HTTPS připojí k API, převezme úlohu
  a stáhne dokument přes krátkodobý podepsaný odkaz.
- Postup: Excel/CSV → přímé parsování (bez AI); PDF s textem → extrakce textu; sken/fotka → OCR;
  pak lokální LLM přes **Ollama** se **strukturovaným výstupem** (JSON dle Zod schématu).
- Model: vision/LLM do ~8 GB (např. třída Qwen2.5-VL 7B / Gemma 3), finální volba podle testu na vzorech
  z `podklady/08-vzory-vyuctovani`. 16 GB RAM je limit, proto běží vždy jen jedna úloha naráz.
- Výsledek jde do stavu **„ke kontrole“**. Obchodník ho potvrdí nebo opraví, teprve pak se zapíše do `services`.
- **Automatická cloudová záloha (Q16):** `ai-worker` posílá každou minutu signál „žiju“. Když signál chybí
  déle než 10 minut (nebo úloha čeká déle než 15 minut), API zpracuje úlohu přes cloudový engine:
  Claude API (model `claude-opus-5-5`, strukturovaný výstup podle stejného Zod schématu).
- Obě cesty implementují stejné rozhraní `ExtractionEngine`, výsledek jde vždy do stavu „ke kontrole“.
- Každé odeslání dokumentu do cloudu se zapíše do audit logu. Manažer může zálohu vypnout.
- Před zapnutím zálohy uzavřít **DPA** s Anthropic a ověřit podmínky uchování dat a lokalitu zpracování.

## 10. Hosting, nasazení, zálohy

**Cloud (produkce):** Hetzner Cloud, Německo. Orientační náklady:
- VPS 4 vCPU / 8 GB RAM: cca 8–15 €/měsíc
- Object Storage: cca 6 €/měsíc
- Storage Box na zálohy: cca 4 €/měsíc
- Celkem **cca 20–25 €/měsíc**

- `docker compose` (caddy, api, worker, postgres, gotenberg), nasazení z GitHub Actions po tagu verze.
- Prostředí: **produkce** a **testovací (staging)** na stejném serveru (oddělené databáze, subdoména),
  abys mohl zkoušet novou verzi před nasazením.

**Zálohy (3-2-1):**
| Co | Jak | Kam | Jak často |
|---|---|---|---|
| DB – průběžně | WAL archivace (wal-g) → obnova k libovolnému okamžiku | Object Storage v **jiné lokalitě** (FI) | průběžně |
| DB – snapshot | `pg_dump` + restic (šifrováno) | Storage Box + **Mac Mini** | denně, 30 denních + 12 měsíčních |
| Dokumenty | restic sync bucketu | Storage Box + **Mac Mini** | denně |
| Test obnovy | automatická obnova do dočasné DB + kontrola | – | týdně, výsledek e-mailem |

Mac Mini si zálohy **stahuje sám** (pull), takže kompromitovaný server nemůže smazat lokální kopie.

**Lokální vývoj:** `pnpm i && docker compose up` (Postgres, MinIO, Mailpit, Gotenberg) → `pnpm dev`.
Na Mac Mini to jde pustit stejně.

## 11. Testování a kvalita

- **Unit testy** `packages/domain`: všechna pravidla (fáze, další krok, eskalace, skóre, retence, provize).
- **Integrační testy API** proti reálnému Postgres v Dockeru: oprávnění (kdo co vidí), migrace, ARES (mock).
- **E2E (web, Playwright)**: přihlášení → firma z ARES → obchod → hovor → úkol.
- **iOS**: testování přes Expo Go (vše kromě CallKit). Dev build s CallKit lze sestavit na Mac Mini
  (Xcode, i s bezplatným Apple ID pro vlastní iPhone). TestFlight až s Apple Developer účtem.
- CI na každý push; migrace se v CI aplikují na prázdnou DB i na DB z předchozí verze.

## 12. Plán fáze 1 (rozdělení na kroky se zastávkami)

| Krok | Obsah | Jak otestuješ |
|---|---|---|
| 1a | monorepo, Docker, CI, DB + migrace, přihlášení (M365 nebo záložní), role, prázdná appka | web: přihlásíš se, vidíš svou roli |
| 1b | firmy + kontakty + ARES + viditelnost + propojení, evidence služeb | založíš firmu z IČO, přidáš SIM |
| 1c | pipeline (kanban + seznam, nastavitelné fáze), aktivity, úkoly, pravidla disciplíny | zkusíš posunout obchod bez aktivity |
| 1d | notifikace (push/web/e-mail), ranní přehled, eskalace, volání + formulář po hovoru, CallKit | iPhone: zavoláš, vrátíš se, zapíšeš |

## 13. Rozhodnutí (ADR log)

| # | Datum | Rozhodnutí | Stav |
|---|---|---|---|
| A1 | 2026-11-23 | Cloud EU (Hetzner) pro aplikaci, Mac Mini pro AI a zálohy | navrženo |
| A2 | 2026-11-23 | Fastify + tRPC, Drizzle, pg-boss, Gotenberg | navrženo |
| A3 | 2026-11-23 | ~~Přihlášení přes Microsoft Entra ID~~ → vlastní přihlášení + TOTP (Microsoft Authenticator) + Face ID; M365 jen pro poštu a kalendář | rozhodnuto (Q14) |
| A4 | 2026-11-23 | Vlastní backoffice modul + CRM adaptér | rozhodnuto (Q1) |
| A5 | 2026-11-23 | Lokální vytěžování (Ollama na Mac Mini), mimo Docker kvůli GPU | rozhodnuto (Q7) |
| A6 | 2026-11-23 | Automatická cloudová záloha vytěžování (Claude API) při výpadku Mac Mini | rozhodnuto (Q16), podmínka DPA |
| A7 | 2026-11-23 | Pracovní kalendář ČR v `domain`; žádné notifikace o víkendech/svátcích | rozhodnuto (Q17) |
| A8 | 2026-11-23 | Veškerá pošta přes M365 (schránky obchodníků + sdílená schránka), bez další e-mailové služby | navrženo |
