# Changelog

Formát podle [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/), verzování [SemVer](https://semver.org/lang/cs/).

## [Unreleased]

### Přidáno – fáze 1a (základ)
- Monorepo (pnpm + Turborepo, TypeScript): `apps/app`, `apps/api`, `packages/db|domain|shared`.
- **Přihlášení:** e-mail + heslo (argon2id) + kód z Microsoft Authenticator (TOTP), 10 záložních kódů,
  povinná změna dočasného hesla při prvním přihlášení, zablokování účtu po 10 neúspěšných pokusech na 15 minut.
- **Relace:** krátkodobý přístupový token (15 min) + obnovovací token (30 dní nečinnosti) s rotací
  a detekcí zneužití; web v httpOnly cookie, iPhone v Keychain.
- **Face ID** na iPhonu: odemčení při startu aplikace a po 5 minutách v pozadí (lze vypnout v Účtu).
- **Role a tým:** obchodník / manažer / backoffice (i více rolí najednou), nadřízený, správa týmu
  pro manažera (založení s dočasným heslem, úprava rolí, deaktivace, obnovení přístupu).
- **Audit log** (přihlášení, změny uživatelů) bez osobních údajů; logy serveru bez hlaviček a vstupních dat.
- **Pracovní kalendář ČR** (svátky vč. Velikonoc, pracovní dny, pravidla eskalace a notifikací) – základ pro fázi 1c/1d.
- Obrazovky: Přihlášení, Můj den (zatím uvítání), Tým, Účet.
- Docker: image API a webu (Caddy), `infra/docker-compose.yml`; CI na GitHub Actions.
- 63 automatických testů (doménová pravidla, přihlášení, oprávnění, HTTP).


### Přidáno
- Specifikace projektu (`docs/SPEC.md`), backlog (`docs/BACKLOG.md`) a tento changelog.
- Odpovědi na otevřené otázky ve specifikaci (v0.2), návrh pravidel disciplíny aktivit.
- Složka `podklady/` pro ceníky, vzory nabídek, provize, loga a další podklady.
- Návrh architektury (`docs/ARCHITECTURE.md`) – čeká na schválení.
- SPEC v0.3: vlastní přihlášení, ranní a večerní přehledy, aktivita Doporučení, klidové víkendy a svátky, automatická cloudová záloha vytěžování, návrh automatických follow-upů a připomínek.
