import { describe, expect, it } from 'vitest';
import { can, permissionsFor } from './permissions';

describe('permissions', () => {
  it('obchodník nemůže spravovat uživatele ani číst reporty', () => {
    expect(can(['sales'], 'users.manage')).toBe(false);
    expect(can(['sales'], 'reports.read')).toBe(false);
    expect(can(['sales'], 'customers.readAll')).toBe(false);
  });
  it('manažer může vše manažerské', () => {
    expect(can(['manager'], 'users.manage')).toBe(true);
    expect(can(['manager'], 'reports.read')).toBe(true);
  });
  it('více rolí = sjednocení oprávnění', () => {
    const p = permissionsFor(['sales', 'backoffice']);
    expect(p.has('backoffice.work')).toBe(true);
    expect(p.has('users.manage')).toBe(false);
  });
});
