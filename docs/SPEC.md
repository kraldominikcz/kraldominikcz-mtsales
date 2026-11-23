# mtSALES – specifikace

> **Živý dokument.** Každá nová funkce nebo změna se nejdřív zapíše sem (včetně dopadu),
> teprve po schválení se programuje. Historie změn specifikace je na konci dokumentu.

| | |
|---|---|
| Verze specifikace | 0.1 (výchozí zadání) |
| Stav | Čeká na doplnění otevřených otázek |
| Vlastník | manageTOGETHER s.r.o. |

## 1. Kontext

- Firma: manageTOGETHER s.r.o. (Zlín), partner Vodafone, B2B prodej telekomunikačních služeb v ČR.
- Aplikace: **mtSALES** – interní obchodní nástroj (lehké CRM) pro web a iOS:
  zákazníci, nabídky, follow-upy, aktivity, hovory, e-maily, dokumenty, reporty.
- Uživatelé: 8 lidí (obchodníci, manažer, backoffice).
- Rozhraní: čeština.
- Identifikátor iOS aplikace: `cz.managetogether.mtsales`

## 2. Principy vývoje

- **Modulárnost:** každá oblast (kontakty, pipeline, volání, e-mail, dokumenty…) je samostatný modul.
- **Řízení změn:** nová funkce/změna → aktualizace tohoto dokumentu → popis dopadu
  (databáze, jiné moduly, odhad práce) → schválení → implementace.
- Nezařazené nápady se vedou v [`BACKLOG.md`](BACKLOG.md) s prioritou.
- Změny databáze vždy přes migrace, data se nikdy neztrácí.
- Změny po verzích se vedou v [`CHANGELOG.md`](CHANGELOG.md).
- Vývoj po fázích; po každé fázi shrnutí + návod k otestování.
- Testy ke klíčové logice; malé commity s jasným popisem.

## 3. Technologie (výchozí návrh, finální volba v ARCHITECTURE.md)

- TypeScript monorepo
- Expo (React Native) + Expo Router: jeden kód pro iOS i web
- Backend: Node.js (TypeScript) + PostgreSQL
- Notifikace: Expo Push (iOS) + web push + e-mail
- iOS sestavení: EAS Build + TestFlight
- Vše spustitelné přes Docker

## 4. Hosting

- K dispozici Mac Mini M4 (16 GB RAM, 256 GB SSD).
- Posoudit Mac Mini vs. cloud v EU.
- Pokud Mac Mini: Docker, bezpečný přístup zvenku (např. Cloudflare Tunnel), HTTPS,
  automatické zálohy databáze i dokumentů **mimo** Mac Mini.
- Na Mac Mini se později bude provozovat i lokální AI.

## 5. Uživatelé a práva

| Role | Oprávnění |
|---|---|
| Obchodník | vidí své zákazníky |
| Manažer | vidí vše + reporty |
| Backoffice | úkoly backoffice |

- Přihlášení e-mailem + 2FA, na iPhonu Face ID.

## 6. Funkce

### 6.1 Zákazníci a kontakty
- Firmy (IČO, adresa, …) + kontaktní osoby, načtení údajů podle IČO z ARES.
- Kompletní historie: hovory, e-maily, schůzky, poznámky, nabídky, dokumenty.
- Každý zákazník má přiděleného obchodníka; možnost předat zákazníka i s historií.
- Import stávajících dat z Excelu/CSV.

### 6.2 Evidence služeb zákazníka (telco)
- Každé číslo/SIM: tarif, uživatel, cena, operátor, datum konce závazku.
- Totéž pro internet, TV a další služby.
- Evidence konkurence: u koho zákazník je, za kolik.

### 6.3 Pipeline obchodů
- Upravitelné fáze, výchozí: Lead → Kontaktován → Schůzka → Nabídka odeslána → Vyjednávání → Vyhráno / Prohráno.
- Zobrazení Kanban + seznam.
- Hodnota obchodu, produkty (mobilní tarify, SIM, internet, TV, …), očekávané datum uzavření.
- U prohraného obchodu povinný důvod.

### 6.4 Úkoly, follow-upy a vymáhání aktivit
- Úkoly s termínem navázané na zákazníka/obchod.
- Každý otevřený obchod **musí** mít naplánovaný další krok, jinak aplikace obchodníka upozorní.
- Připomínky před termínem a upozornění po termínu.
- Eskalace: úkol X dní po termínu → upozornění manažerovi.
- Ranní přehled dne pro každého obchodníka (push + e-mail).
- Obchod nelze posunout do další fáze bez zapsané aktivity.

### 6.5 Retence podle konce závazků
- Automatické úkoly 6, 3 a 1 měsíc před koncem závazku.
- Přehled „končící závazky“ pro obchodníka i manažera.
- Upsell tipy: zákazník má mobily, ale ne internet/TV → upozornit.

### 6.6 Volání
- Klik na číslo → klasický hovor v telefonu (`tel:` odkaz), žádné VoIP.
- Aplikace zapíše pokus o hovor (kdo, komu, kdy) do historie.
- Po návratu do aplikace hned zobrazí formulář: výsledek, poznámka, další krok, posun v pipeline.
- Když obchodník aktivitu nezapíše, připomene mu to notifikací (např. po 15 min).
- Na iOS zkusit zjistit délku hovoru přes CallKit (`CXCallObserver`), pokud to v Expo jde.
- **Omezení:** iOS nedovoluje nahrávat hovory ani číst výpis hovorů – neimplementovat.
- Na webu: `tel:` odkaz + ruční zápis.

### 6.7 E-mail
- Nabídky se odesílají z aplikace z firemní adresy (doména: **[DOPLNIT]**, e-mail běží na: **[DOPLNIT]**).
- Odpověď zákazníka dojde obchodníkovi, který nabídku poslal, a uloží se do historie kontaktu.
- Navrhnout řešení (Reply-To s unikátním ID + příjem přes webhook, nebo napojení na M365/Google API).
- Šablony e-mailů pro follow-upy.
- Volitelně: sledování otevření nabídky.

### 6.8 Nabídky
- Šablony nabídek → PDF s logem.
- **Povinně:** pokud je součástí řešení TV, nabídka musí obsahovat stránku se seznamem TV programů.
- Verze a stavy (koncept, odesláno, přijato, odmítnuto).
- Elektronický podpis nabídky/dodatku zákazníkem (navrhnout službu).

### 6.9 Srovnávací kalkulačka
- Nahrání vyúčtování od současného operátora (O2, T-Mobile…).
- Vytěžení čísel, tarifů a cen, porovnání s nabídkou Vodafone, výpočet úspory.
- Z výsledku jedním klikem vytvořit nabídku.

### 6.10 Dokumenty a vytěžování dat
- Nahrávání k zákazníkovi: PDF, skeny, fotky z iPhonu, Excel.
- Vytěžení (OCR + AI, např. Claude API): smlouvy, faktury, seznamy SIM, vyúčtování
  → strukturovaná data (čísla, tarify, ceny, konec závazku).
- Obchodník vytěžená data zkontroluje a potvrdí, než se uloží.
- Fulltextové vyhledávání v dokumentech.

### 6.11 Provize
- Pravidla provizí (nastaví manažer).
- Obchodník vidí: vydělané provize, čekající provize, potenciál v pipeline.

### 6.12 Reporty
- Pipeline podle obchodníka a fáze, aktivity za období, úspěšnost.
- Končící závazky, provize, cíle a plnění.
- Týdenní automatický report pro manažera.
- Export do Excelu a PDF.

### 6.13 Napojení na stávající CRM / backoffice
- Stávající CRM: **[DOPLNIT název + odkaz na API dokumentaci, pokud existuje]**.
- Úkoly pro backoffice (přenos čísel, dodatky, aktivace SIM…) se předávají do CRM.
- Sledování přenosu čísel: stavy, termíny, upozornění při zaseknutí.
- Integrace přes vyměnitelný adaptér.
- Pokud API není nebo je nevhodné: navrhnout vlastní backoffice modul (fronta úkolů, stavy, komentáře)
  a zhodnotit, co je efektivnější.

## 7. Bezpečnost a GDPR

- Šifrování, přístup podle rolí, audit log (kdo co viděl/změnil).
- Data v EU, pravidelné zálohy.
- Export a výmaz údajů osoby na žádost.
- Žádné osobní údaje v logech.

## 8. Fáze

| # | Fáze | Obsah | Stav |
|---|---|---|---|
| 1 | Základ | přihlášení, role, zákazníci, ARES, evidence služeb, pipeline, úkoly, notifikace, volání | čeká |
| 2 | Retence | konce závazků + upsell tipy | čeká |
| 3 | E-mail a nabídky | PDF, e-podpis | čeká |
| 4 | Dokumenty | vytěžování, srovnávací kalkulačka | čeká |
| 5 | Provize a reporty | | čeká |
| 6 | CRM / backoffice | napojení + přenos čísel | čeká |
| 7 | Nasazení | Mac Mini nebo cloud + TestFlight | čeká |

## 9. Otevřené otázky

| # | Otázka | Odpověď |
|---|---|---|
| Q1 | Jaké CRM používáme a má API? | – |
| Q2 | Na čem běží firemní e-mail a z jaké domény posílat nabídky? | – |
| Q3 | Mac Mini, nebo cloud? | – |
| Q4 | Odkud brát ceník a katalog produktů Vodafone? | – |
| Q5 | Jak se počítají provize? | – |
| Q6 | Jaká data máme k importu a v jakém formátu? | – |

## 10. Historie změn specifikace

| Datum | Verze | Změna |
|---|---|---|
| 2026-11-23 | 0.1 | Výchozí zadání |
