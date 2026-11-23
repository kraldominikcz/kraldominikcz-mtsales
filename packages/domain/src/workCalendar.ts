/**
 * Pracovní kalendář ČR.
 *
 * Kalendářní dny se zapisují jako řetězec `YYYY-MM-DD` (den v časové zóně Europe/Prague).
 * Okamžiky (Date) se na kalendářní den převádějí přes `toPragueDate`.
 */

export const PRAGUE_TZ = 'Europe/Prague';

export type IsoDate = string; // YYYY-MM-DD

export interface Holiday {
  date: IsoDate;
  name: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;

function parseIso(date: IsoDate): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Neplatné datum: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Posun kalendářního dne o n dní (bez ohledu na časové zóny). */
export function addDays(date: IsoDate, n: number): IsoDate {
  const { y, m, d } = parseIso(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Den v týdnu: 0 = neděle … 6 = sobota. */
export function dayOfWeek(date: IsoDate): number {
  const { y, m, d } = parseIso(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Velikonoční neděle (gregoriánský kalendář, anonymní algoritmus). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

const holidayCache = new Map<number, Holiday[]>();

/** Státní svátky a ostatní svátky ČR (dny pracovního klidu) pro daný rok. */
export function czechHolidays(year: number): Holiday[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: iso(year, 1, 1), name: 'Den obnovy samostatného českého státu, Nový rok' },
    { date: addDays(easter, -2), name: 'Velký pátek' },
    { date: addDays(easter, 1), name: 'Velikonoční pondělí' },
    { date: iso(year, 5, 1), name: 'Svátek práce' },
    { date: iso(year, 5, 8), name: 'Den vítězství' },
    { date: iso(year, 7, 5), name: 'Den slovanských věrozvěstů Cyrila a Metoděje' },
    { date: iso(year, 7, 6), name: 'Den upálení mistra Jana Husa' },
    { date: iso(year, 9, 28), name: 'Den české státnosti' },
    { date: iso(year, 10, 28), name: 'Den vzniku samostatného československého státu' },
    { date: iso(year, 11, 17), name: 'Den boje za svobodu a demokracii' },
    { date: iso(year, 12, 24), name: 'Štědrý den' },
    { date: iso(year, 12, 25), name: '1. svátek vánoční' },
    { date: iso(year, 12, 26), name: '2. svátek vánoční' },
  ];
  list.sort((a, b) => a.date.localeCompare(b.date));
  holidayCache.set(year, list);
  return list;
}

export function isHoliday(date: IsoDate): boolean {
  const { y } = parseIso(date);
  return czechHolidays(y).some((h) => h.date === date);
}

export function isWeekend(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

export function isWorkingDay(date: IsoDate): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/** Kalendářní den a čas v Praze pro daný okamžik. */
export function toPragueParts(instant: Date): { date: IsoDate; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRAGUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function toPragueDate(instant: Date): IsoDate {
  return toPragueParts(instant).date;
}

/** Nejbližší pracovní den >= date. */
export function nextWorkingDay(date: IsoDate): IsoDate {
  let d = date;
  while (!isWorkingDay(d)) d = addDays(d, 1);
  return d;
}

/** Přičte n pracovních dní (n >= 0). Pro n = 0 vrací nejbližší pracovní den. */
export function addWorkingDays(date: IsoDate, n: number): IsoDate {
  if (n < 0) throw new Error('n musí být >= 0');
  let d = nextWorkingDay(date);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

/** Počet pracovních dní v intervalu (from, to] – tedy po `from` až do `to` včetně. */
export function workingDaysBetween(from: IsoDate, to: IsoDate): number {
  if (to <= from) return 0;
  let count = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    if (isWorkingDay(d)) count++;
  }
  return count;
}

/**
 * Má se úkol eskalovat nadřízenému?
 * Ano, pokud od dne termínu uplynulo alespoň `days` pracovních dní a dnes je pracovní den.
 * Příklad: termín v pondělí → eskalace ve středu; termín v pátek → eskalace v úterý.
 */
export function escalationDue(dueAt: Date, now: Date, days = 2): boolean {
  const today = toPragueDate(now);
  if (!isWorkingDay(today)) return false;
  return workingDaysBetween(toPragueDate(dueAt), today) >= days;
}

export type NotificationAudience = 'internal' | 'customer';

/** Pracovní doba pro automatické zprávy zákazníkům (8:00–17:00). */
export const CUSTOMER_HOURS = { from: 8, to: 17 } as const;

/**
 * Smí se teď poslat notifikace?
 * - interní (obchodníci, manažeři): jen v pracovní den,
 * - zákazník: jen v pracovní den a v pracovní době 8:00–17:00.
 */
export function canNotify(now: Date, audience: NotificationAudience): boolean {
  const { date, hour } = toPragueParts(now);
  if (!isWorkingDay(date)) return false;
  if (audience === 'customer') return hour >= CUSTOMER_HOURS.from && hour < CUSTOMER_HOURS.to;
  return true;
}
