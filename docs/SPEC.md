# mtSALES – specifikace

> **Živý dokument.** Každá nová funkce nebo změna se nejdřív zapíše sem (včetně dopadu),
> teprve po schválení se programuje. Historie změn specifikace je na konci dokumentu.

| | |
|---|---|
| Verze specifikace | 0.3 (přihlášení, přehledy, klidové dny, záložní AI) |
| Stav | Čeká na schválení architektury a návrhu pravidel disciplíny (6.4.1) |
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

- **Rozhodnuto (Q3):** aplikace a databáze běží v cloudu v EU (návrh: Hetzner, DE/FI).
- Mac Mini M4 (16 GB RAM, 256 GB SSD) stojí v kanceláři se stabilním garantovaným internetem a slouží:
  - pro **lokální AI** (vytěžování dokumentů, později přepisy hlasových poznámek),
  - jako **druhé místo pro zálohy** (lokální kopie databáze i dokumentů).
- Zálohy se ukládají **v cloudu i lokálně na Mac Mini** (pravidlo 3-2-1).
- Podrobnosti v [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 5. Uživatelé a práva

| Role | Oprávnění |
|---|---|
| Obchodník | plná práce se svými zákazníky; u cizích zákazníků omezený pohled (viz 5.1) |
| Manažer | vidí vše + reporty + nastavení pravidel |
| Backoffice | úkoly backoffice |

- Jeden uživatel může mít **více rolí**. Manažeři jsou zároveň obchodníci (Q13) a platí pro ně
  **stejná pravidla a stejný tlak** jako pro ostatní obchodníky (viz 6.4.1).
- Každý uživatel má volitelně nastaveného **nadřízeného**, kterému chodí eskalace.
- Přihlášení: **vlastní přihlášení aplikace pro všechny** – e-mail + heslo + 2FA kódem z **Microsoft Authenticator**
  (TOTP); na iPhonu po prvním přihlášení **Face ID** (Q12). Účet M365 není podmínkou (Q14: nemají ho všichni).

### 5.1 Viditelnost firem mezi obchodníky (Q11)
- Obchodníci **vidí i firmy, které řeší kolegové**, aby nevznikaly duplicity a dalo se navázat na souvislosti.
- Jedna firma = jedno IČO (žádné duplicity). Když obchodník zakládá firmu kolegy, aplikace mu ukáže vlastníka
  a nabídne „požádat o předání“ nebo „spolupracovat“.
- **Propojení firem** – aplikace co nejvíc vytěží data a ukáže souvislosti:
  stejný obor (CZ-NACE z ARES), stejná adresa/budova, stejné osoby (statutáři z ARES, kontaktní osoby
  se stejným jménem, e-mailem nebo telefonem), stejná e-mailová doména, stejná skupina/vlastník.
- **Rozhodnuto (Q15):** u cizí firmy obchodník vidí kartu firmy, kontakty, propojení, vlastníka,
  **služby včetně cen** a datum poslední aktivity. Obchody, nabídky a poznámky vidí jen vlastník a manažeři.

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
- **Rozhodnuto (Q11, Q17):** eskalace na nadřízeného po **2 pracovních dnech** po termínu.
- **Víkendy a státní svátky ČR: žádné notifikace** (push ani e-mail). Co se o víkendu stane (např. nezapsaný
  hovor), objeví se v ranním přehledu nejbližšího pracovního dne. Termíny na víkend se počítají jako po termínu
  až od dalšího pracovního dne.

### 6.4.2 Ranní a večerní přehled (Q17)
Každý pracovní den dvakrát – **ráno v 9:00** a **večer v 17:00** (čas večerního přehledu je návrh, Q19) –
přijde každému obchodníkovi (i manažerům) push + e-mail:
- **Rozpracovanost obchodních případů:** počet a hodnota otevřených obchodů podle fáze, obchody bez dalšího kroku,
  obchody bez aktivity déle než X dní, co se dnes posunulo / vyhrálo / prohrálo.
- **Počty aktivit** (den / týden / proti týdennímu cíli): telefonáty, schůzky, vytvořené a odeslané nabídky,
  e-maily, **získaná doporučení** a další typy aktivit.
- **Úkoly:** ráno plán dne a co propadlo; večer co zůstalo nesplněné a nezapsané hovory/schůzky.
- Skóre disciplíny (6.4.1).
- Manažeři navíc dostanou **týmovou verzi** (stejné údaje za každého člena týmu).

### 6.4.3 Získané doporučení (nový typ aktivity)
- Aktivita „Doporučení“ se zapisuje u firmy/kontaktu, který doporučil. Jedním klikem z ní vznikne
  **lead v pipeline** u doporučené firmy (načtené z ARES) se zdrojem „doporučení od …“.
- Počítá se v přehledech a reportech (kolik doporučení kdo získal a kolik z nich se proměnilo v obchod).

### 6.4.1 Disciplína aktivit – „přirozený tlak“ (NÁVRH, čeká na schválení – Q18)
Cíl: obchodníci (včetně manažerů) plní aktivity a follow-upy, protože jim to aplikace usnadňuje
a protože jsou výsledky vidět, ne kvůli ručnímu kontrolování.

**Tvrdá pravidla (aplikace nepustí dál):**
1. Posun obchodu do další fáze jen se zapsanou aktivitou od posledního posunu.
2. Prohraný obchod jen s důvodem; vyhraný obchod jen s vyplněnými produkty a hodnotou.
3. Otevřený obchod nelze uložit ani opustit bez **dalšího kroku** (úkol s termínem). Jediná cesta ven je
   naplánovat krok, nebo obchod uzavřít.
4. Po hovoru se hned otevře formulář zápisu. Nezapsaný hovor zůstává „visící“ (připomínka po 15 min
   a v souhrnu na konci dne).

**Měkká pravidla (tlak, ne blokace):**
5. **Domovská obrazovka „Můj den“**: nejdřív věci po termínu, pak dnešní úkoly, nezapsané hovory a obchody bez dalšího kroku.
6. **Režim „Nejdřív dořeš“**: kdo má obchody bez dalšího kroku nebo víc než N úkolů po termínu (výchozí N = 5),
   nemůže zakládat nové obchody, dokud to nedořeší. Prohlížet a volat může dál.
7. **Skóre disciplíny 0–100** pro každého (podíl obchodů s naplánovaným krokem, úkoly po termínu,
   nezapsané hovory, plnění týdenního cíle aktivit). Skóre **vidí celý tým**, manažery nevyjímaje.
8. **Týdenní cíle aktivit** (hovory, schůzky, nabídky) pro každého, nastavuje manažer. V aplikaci je ukazatel plnění.
9. **Ranní přehled v 9:00 a večerní přehled** (push + e-mail), obsah viz 6.4.2.
10. Nezapsané hovory a schůzky z dneška jsou ve večerním přehledu (samostatná připomínka 16:30 odpadá).
11. **Eskalace po 2 pracovních dnech** jde nadřízenému. Pokud nadřízeného nemá (nebo je to manažer sám),
    jde ostatním manažerům, takže nikdo eskalaci neunikne.
12. **Týdenní souhrn týmu** (pondělí ráno) všem: skóre disciplíny a aktivity každého. Je to základ žebříčku z backlogu (B5).

Vše je nastavitelné manažerem (prahy, časy, cíle, zapnutí/vypnutí pravidel 6–12).
O víkendech a svátcích se neposílá nic (viz 6.4).

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
- Nabídky se odesílají z aplikace z firemní adresy. Doména: **návrh v Q2, čeká na ověření dostupnosti**.
  E-mail poběží na **Microsoft 365 (Exchange Online / Outlook)**.
- Odpověď zákazníka dojde obchodníkovi, který nabídku poslal, a uloží se do historie kontaktu.
- **Rozhodnuto (Q2):** napojení přes **Microsoft Graph API**. E-mail odchází ze skutečné schránky obchodníka
  (je vidět i v jeho Outlooku v Odeslaných), odpovědi zachytí Graph change notifications (webhook)
  a spárují se podle vlákna (conversationId) a interní hlavičky s ID nabídky.
- Obchodníci **bez M365 schránky** (Q14): dokoupí se licence. Návrh **Microsoft 365 Business Basic**
  (schránka + Teams + OneDrive), minimum **Exchange Online Plan 1** (jen schránka). Pro aplikaci stačí obojí (Q20).
- Všechny e-maily zákazníkům jdou ze **schránky obchodníka přes M365**. Odpovědi tak chodí jemu a vše je
  i v Outlooku. Systémové e-maily (přehledy, upozornění pro tým) jdou ze sdílené schránky `mtsales@<doména>`,
  která licenci nepotřebuje. Žádná další e-mailová služba není potřeba.

### 6.7.1 Automatické follow-upy a připomínky (NÁVRH, čeká na schválení – Q22)
Nabídky i follow-upy se posílají **z aplikace**, follow-upy i **automaticky**.

**Follow-up sekvence po odeslání nabídky** (šablony a časy nastavuje manažer, obchodník je může u konkrétní nabídky
upravit nebo pozastavit). Výchozí návrh:
1. Den 0: odeslání nabídky ze schránky obchodníka.
2. +3 pracovní dny bez odpovědi: automatický e-mail „Dostal jste naši nabídku?“.
3. +5 pracovních dní: úkol pro obchodníka „Zavolat k nabídce“ (s připomínkou).
4. +10 pracovních dní: druhý automatický e-mail a pak úkol „Rozhodnout: pokračovat / prohráno“.
- Sekvence se **sama zastaví**, když zákazník odpoví (zachyceno přes M365), nabídku přijme/odmítne
  nebo obchodník změní stav.
- Automatické e-maily vypadají jako běžný e-mail obchodníka (jeho podpis, jeho schránka), ne jako hromadná rozesílka.
- Režim pro každou šablonu: **odeslat automaticky** nebo **připravit koncept ke schválení** (obchodník jen klikne „Odeslat“).

**Připomínky hovorů a schůzek:**
- **Obchodník:** push + e-mail před naplánovaným hovorem/schůzkou (výchozí 15 min před, nastavitelné).
- **Zákazník:** při naplánování hovoru/schůzky dostane **pozvánku do kalendáře** (Outlook/Google/Apple ji umí přijmout)
  a **připomínkový e-mail** (výchozí den předem). Volitelně **SMS připomínka** přes českou SMS bránu (Q23).
- Zákazník může v připomínce kliknout „Potvrdit / Přeplánovat“. Odpověď se zapíše do historie a upozorní obchodníka.

**Pravidla pro zákazníky:**
- Automatické e-maily a připomínky zákazníkům chodí **jen v pracovní dny v pracovní době** (8–17 h),
  nikdy o víkendech a svátcích.
- Automatické e-maily obsahují odkaz „Nepřeji si další připomínky“ (GDPR). Kontakt je pak z automatik vyřazen
  a obchodník dostane upozornění.

**Dopad:** modul `email` + nový modul `automations` (sekvence, kroky, zařazení nabídek do sekvence),
`tasks`, `notifications`, kalendář přes M365 (Graph Calendar). DB: nové tabulky pro sekvence a připomínky.
Patří do **fáze 3**, kterou to zvětší odhadem o třetinu.
- Šablony e-mailů pro follow-upy.
- Volitelně: sledování otevření nabídky.

### 6.8 Nabídky
- Šablony nabídek → PDF s logem.
- **Povinně:** pokud je součástí řešení TV, nabídka musí obsahovat stránku se seznamem TV programů.
- Verze a stavy (koncept, odesláno, přijato, odmítnuto).
- Elektronický podpis nabídky/dodatku zákazníkem (navrhnout službu).
  - **Rozhodnuto (Q8):** firma má **DocuSign**. Pro aplikaci není nutný; napojení bude **volitelné**
    přes adaptér (odeslat k podpisu → stav podpisu → podepsané PDF do dokumentů).
- Vzor nabídky dodá zadavatel do `podklady/02-vzor-nabidky/` (Q4).
- Seznam TV programů dodá zadavatel do `podklady/03-tv-programy/` (Q9). Seznam bude v aplikaci
  verzovaný podle TV balíčku.

### 6.9 Srovnávací kalkulačka
- Nahrání vyúčtování od současného operátora (O2, T-Mobile…).
- Vytěžení čísel, tarifů a cen, porovnání s nabídkou Vodafone, výpočet úspory.
- Z výsledku jedním klikem vytvořit nabídku.

### 6.10 Dokumenty a vytěžování dat
- Nahrávání k zákazníkovi: PDF, skeny, fotky z iPhonu, Excel.
- Vytěžení (OCR + AI): smlouvy, faktury, seznamy SIM, vyúčtování
  → strukturovaná data (čísla, tarify, ceny, konec závazku).
- **Rozhodnuto (Q7, Q16):** vytěžování běží **primárně lokálně na Mac Mini** (lokální OCR + lokální jazykový model).
  **Když Mac Mini neběží, automaticky se zapne záložní zpracování v cloudu** (AI služba přes API), aby obchodník
  nečekal. Které dokumenty šly do cloudu, se zapisuje do audit logu; manažer může zálohu vypnout.
  Před spuštěním zálohy je potřeba smlouva o zpracování osobních údajů (DPA) s poskytovatelem AI.
- Obchodník vytěžená data zkontroluje a potvrdí, než se uloží.
- Fulltextové vyhledávání v dokumentech.

### 6.11 Provize
- Pravidla provizí (nastaví manažer).
- Výpočet podle firemního Excelu se vzorcem, který zadavatel dodá do `podklady/04-provize/` (Q5),
  spolu s manuálem. Pravidla budou verzovaná, aby staré provize zůstaly spočítané podle starých pravidel.
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
- **Rozhodnuto (Q1):** stavíme **vlastní backoffice modul**. Rozhraní adaptéru na externí CRM bude
  připravené. Zadavatel má k CRM token a příkaz pro Claude Code, napojení zhodnotíme ve fázi 6.
  Token se **nikdy nevkládá do chatu ani do repozitáře**, předá se přes zabezpečený formulář prostředí.

## 7. Bezpečnost a GDPR

- Šifrování, přístup podle rolí, audit log (kdo co viděl/změnil).
- Data v EU, pravidelné zálohy.
- Export a výmaz údajů osoby na žádost.
- Žádné osobní údaje v logech.

### 6.14 Ceník a katalog produktů (Q4)
- Ceník Vodafone dodá zadavatel do `podklady/01-cenik-vodafone/`.
- V aplikaci ho spravuje manažer; import z Excelu, **verzovaný** (nabídka si drží verzi ceníku,
  ze které vznikla).

### 6.15 Data na startu (Q6)
- **Začínáme od nuly**, bez hromadného importu. Zákazníky a data přidáváme postupně, přechod z původního
  způsobu práce je postupný. Import z Excelu/CSV (6.1) zůstává, ale ne jako priorita fáze 1.

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
| Q1 | Jaké CRM používáme a má API? | Vlastní backoffice modul; CRM má token, napojení zhodnotíme ve fázi 6. |
| Q2 | Na čem běží firemní e-mail a z jaké domény posílat nabídky? | Microsoft 365 (Outlook/Exchange). Doménu navrhuje Claude, dostupnost ověří zadavatel. |
| Q3 | Mac Mini, nebo cloud? | Cloud EU pro aplikaci; Mac Mini (kancelář, garantovaný internet) pro lokální AI a zálohy. |
| Q4 | Odkud brát ceník a katalog produktů Vodafone? | Zadavatel dodá do `podklady/`, verzovaně. Včetně vzoru nabídky. |
| Q5 | Jak se počítají provize? | Excel se vzorcem + manuál dodá zadavatel do `podklady/04-provize/`. |
| Q6 | Jaká data máme k importu a v jakém formátu? | Začínáme od nuly, přechod postupný. |
| Q7 | Smí AI zpracovávat dokumenty v cloudu? | Ne, lokálně na Mac Mini, s možností zálohy (viz Q16). |
| Q8 | Služba pro e-podpis? | DocuSign, volitelné napojení. |
| Q9 | Odkud seznam TV programů? | Zadavatel dodá do `podklady/03-tv-programy/`. |
| Q10 | Apple Developer účet, logo? | Účet zatím není – úkol pro zadavatele (viz 11). Loga dodá zadavatel. |
| Q11 | Eskalace, ranní přehled, viditelnost? | Eskalace po 2 dnech, přehled v 9:00, obchodníci vidí firmy kolegů + propojení. |
| Q12 | Způsob 2FA? | Microsoft Authenticator, na iPhonu Face ID po prvním přihlášení. |
| Q13 | Jsou manažeři i obchodníci? | Ano; stejný tlak na všechny. |
| Q14 | Máte M365 tenant a mají všichni licenci (Exchange schránku)? | Ne všichni → vlastní přihlášení pro všechny. |
| Q15 | Co přesně vidí obchodník u firmy kolegy? | Kartu, kontakty, propojení, vlastníka, služby **včetně cen**, poslední aktivitu. |
| Q16 | Záloha lokálního vytěžování? | Když Mac Mini neběží, automaticky cloud. |
| Q17 | Pracovní dny? | Eskalace po 2 dnech; přehled ráno i večer (rozpracovanost + počty aktivit); víkendy a svátky bez notifikací. |
| Q18 | Schvaluješ pravidla disciplíny 6.4.1? | – |
| Q19 | V kolik posílat večerní přehled? (návrh 17:00) | – |
| Q20 | E-mail pro lidi bez M365? | Dokoupit licenci (návrh Business Basic, minimum Exchange Online Plan 1). |
| Q21 | Schvaluješ architekturu (`ARCHITECTURE.md`)? | – |
| Q22 | Schvaluješ automatické follow-upy a připomínky (6.7.1)? Posílat automaticky, nebo jako koncept ke schválení? | – |
| Q23 | Chcete i SMS připomínky zákazníkům (placené za SMS)? | – |

## 10. Podklady od zadavatele

Všechny podklady (ceníky, vzory, provize, TV programy, loga, manuály, reporty) se nahrávají do složky
[`podklady/`](../podklady/README.md). Popis podsložek je v jejím README.

## 11. Úkoly pro zadavatele (mimo kód)

| Úkol | Kdy je potřeba | Poznámka |
|---|---|---|
| Ověřit a zaregistrovat doménu | před fází 3 (e-mail) | návrh v Q2 |
| Microsoft 365: registrace aplikace v Entra ID (s pomocí Claude) | fáze 3 (e-mail) | potřeba admin účet M365 |
| Dokoupit M365 licence lidem bez schránky (Q20) | před fází 3 | Business Basic nebo Exchange Online Plan 1 |
| Účet Hetzner Cloud (firemní) | fáze 7, ideálně dřív kvůli testovacímu prostředí | |
| Apple Developer Program – organizace (99 USD/rok) | před TestFlightem (fáze 7) | vyžaduje **D-U-N-S číslo** firmy; vyřízení trvá dny až týdny, začít s předstihem |
| Nahrát podklady do `podklady/` | průběžně, ceník a vzor nabídky před fází 3 | žádné osobní údaje zákazníků, jen anonymizované vzory |

## 12. Historie změn specifikace

| Datum | Verze | Změna |
|---|---|---|
| 2026-11-23 | 0.1 | Výchozí zadání |
| 2026-11-23 | 0.3 | Vlastní přihlášení pro všechny, ceny viditelné i u firem kolegů, ranní + večerní přehled (6.4.2), aktivita Doporučení (6.4.3), návrh automatických follow-upů a připomínek (6.7.1), klidové víkendy a svátky, automatická cloudová záloha vytěžování |
| 2026-11-23 | 0.2 | Odpovědi na Q1–Q13, viditelnost firem (5.1), návrh pravidel disciplíny (6.4.1), ceník (6.14), start od nuly (6.15), podklady, úkoly pro zadavatele |
