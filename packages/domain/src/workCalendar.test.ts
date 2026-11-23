import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  canNotify,
  czechHolidays,
  easterSunday,
  escalationDue,
  isWorkingDay,
  toPragueDate,
  workingDaysBetween,
} from './workCalendar';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
  ])('%i → %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('czechHolidays', () => {
  it('obsahuje 13 dní pracovního klidu včetně Velkého pátku a Velikonočního pondělí', () => {
    const h = czechHolidays(2026).map((x) => x.date);
    expect(h).toHaveLength(13);
    expect(h).toContain('2026-04-03'); // Velký pátek
    expect(h).toContain('2026-04-06'); // Velikonoční pondělí
    expect(h).toContain('2026-11-17');
    expect(h).toContain('2026-12-24');
  });
});

describe('isWorkingDay', () => {
  it('víkend není pracovní den', () => {
    expect(isWorkingDay('2026-11-21')).toBe(false); // sobota
    expect(isWorkingDay('2026-11-22')).toBe(false); // neděle
  });
  it('svátek není pracovní den', () => {
    expect(isWorkingDay('2026-11-17')).toBe(false);
    expect(isWorkingDay('2026-05-08')).toBe(false);
  });
  it('běžný všední den je pracovní', () => {
    expect(isWorkingDay('2026-11-23')).toBe(true); // pondělí
  });
});

describe('addWorkingDays / workingDaysBetween', () => {
  it('přeskakuje víkend', () => {
    expect(addWorkingDays('2026-11-20', 1)).toBe('2026-11-23'); // pátek + 1 → pondělí
  });
  it('přeskakuje Vánoce', () => {
    expect(addWorkingDays('2026-12-23', 1)).toBe('2026-12-28'); // st → po (24.–27. volno)
  });
  it('n = 0 vrací nejbližší pracovní den', () => {
    expect(addWorkingDays('2026-11-21', 0)).toBe('2026-11-23');
    expect(addWorkingDays('2026-11-23', 0)).toBe('2026-11-23');
  });
  it('počítá pracovní dny v intervalu (from, to]', () => {
    expect(workingDaysBetween('2026-11-20', '2026-11-24')).toBe(2); // po, út
    expect(workingDaysBetween('2026-11-24', '2026-11-24')).toBe(0);
    expect(workingDaysBetween('2026-11-25', '2026-11-24')).toBe(0);
  });
});

describe('escalationDue – 2 pracovní dny po termínu', () => {
  const at = (s: string) => new Date(s);
  it('termín v pondělí → eskalace až ve středu', () => {
    const due = at('2026-11-23T10:00:00+01:00');
    expect(escalationDue(due, at('2026-11-24T10:00:00+01:00'))).toBe(false);
    expect(escalationDue(due, at('2026-11-25T08:00:00+01:00'))).toBe(true);
  });
  it('termín v pátek → eskalace v úterý, o víkendu nic', () => {
    const due = at('2026-11-20T16:00:00+01:00');
    expect(escalationDue(due, at('2026-11-22T10:00:00+01:00'))).toBe(false); // neděle
    expect(escalationDue(due, at('2026-11-23T10:00:00+01:00'))).toBe(false); // pondělí = 1 den
    expect(escalationDue(due, at('2026-11-24T10:00:00+01:00'))).toBe(true); // úterý = 2 dny
  });
  it('ve svátek se neeskaluje', () => {
    const due = at('2026-11-12T10:00:00+01:00'); // čtvrtek
    expect(escalationDue(due, at('2026-11-17T10:00:00+01:00'))).toBe(false); // 17. 11.
  });
});

describe('canNotify', () => {
  it('interní notifikace jen v pracovní den', () => {
    expect(canNotify(new Date('2026-11-23T21:00:00+01:00'), 'internal')).toBe(true);
    expect(canNotify(new Date('2026-11-22T09:00:00+01:00'), 'internal')).toBe(false);
  });
  it('zákazníkům jen v pracovní den 8–17 h pražského času', () => {
    expect(canNotify(new Date('2026-11-23T07:59:00+01:00'), 'customer')).toBe(false);
    expect(canNotify(new Date('2026-11-23T08:00:00+01:00'), 'customer')).toBe(true);
    expect(canNotify(new Date('2026-11-23T16:59:00+01:00'), 'customer')).toBe(true);
    expect(canNotify(new Date('2026-11-23T17:00:00+01:00'), 'customer')).toBe(false);
    expect(canNotify(new Date('2026-12-24T10:00:00+01:00'), 'customer')).toBe(false);
  });
  it('respektuje letní čas', () => {
    // 2026-07-01 07:30 UTC = 9:30 v Praze (UTC+2)
    expect(canNotify(new Date('2026-07-01T05:30:00Z'), 'customer')).toBe(false); // 7:30
    expect(canNotify(new Date('2026-07-01T06:30:00Z'), 'customer')).toBe(true); // 8:30
  });
});

describe('toPragueDate', () => {
  it('půlnoc v Praze je jiný den než v UTC', () => {
    expect(toPragueDate(new Date('2026-11-23T23:30:00Z'))).toBe('2026-11-24');
  });
});
