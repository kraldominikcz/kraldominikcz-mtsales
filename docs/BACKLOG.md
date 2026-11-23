# mtSALES – backlog

Nezařazené funkce a nápady. Priorita: **P1** (brzy po dokončení fází), **P2** (užitečné), **P3** (nice-to-have).
Priority jsou výchozí odhad – uprav podle potřeby.

| # | Funkce | Priorita | Poznámka / závislosti |
|---|---|---|---|
| B1 | Hlasová poznámka po schůzce → AI přepis, shrnutí a další krok | P1 | navazuje na modul aktivit; přepis lokálně (Whisper na Mac Mini) nebo přes API |
| B2 | Skenování vizitky iPhonem | P2 | OCR/AI z fáze 4 |
| B3 | Mapa zákazníků, plánování návštěv, check-in na schůzce (GPS) | P2 | geokódování adres z ARES |
| B4 | Lead scoring: komu volat dnes jako prvnímu | P2 | potřebuje historii aktivit a konce závazků |
| B5 | Žebříček obchodníků | P3 | data z reportů (fáze 5) |
| B6 | Leady z webů obchodníků (kalkulačka, doporučení) rovnou do pipeline | P2 | veřejné API / webhook pro leady |
| B7 | Spokojenost zákazníka (NPS) po aktivaci | P3 | e-mail modul (fáze 3) |
| B8 | Žádosti o hardware (telefony, routery) a jejich stav | P2 | backoffice modul (fáze 6) |

## Technický dluh a vylepšení

| # | Položka | Priorita | Poznámka |
|---|---|---|---|
| T1 | E2E testy webu (Playwright) v repozitáři a v CI | P2 | v 1a ověřeno ručním skriptem (celé přihlášení) |
| T2 | Firemní barvy a logo v aplikaci | P1 | čeká na `podklady/07-loga-a-brand` |
| T3 | Ikony v dolní liště a ikona aplikace | P2 | spolu s T2 |
| T4 | Uživatel si sám změní heslo / znovu nastaví Authenticator (bez manažera) | P2 | dnes přes „Obnovit přístup“ u manažera |
