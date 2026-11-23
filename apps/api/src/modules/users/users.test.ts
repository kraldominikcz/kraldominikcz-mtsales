import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'OK',
    (e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
  );

describe('správa uživatelů – oprávnění', () => {
  it('nepřihlášený nevidí nic, obchodník nemůže zakládat uživatele', async () => {
    const anon = await h.caller();
    expect(await code(anon.users.list())).toBe('UNAUTHORIZED');

    const sales = await h.onboardUser({ roles: ['sales'] });
    const api = await h.caller({ accessToken: sales.session.accessToken });
    expect(await code(api.users.list())).toBe('OK');
    expect(
      await code(api.users.create({ email: 'x@example.test', name: 'Xaver', roles: ['sales'] })),
    ).toBe('FORBIDDEN');
  });

  it('manažer založí uživatele s dočasným heslem; duplicitní e-mail neprojde', async () => {
    const mgr = await h.onboardUser({ roles: ['manager', 'sales'] });
    const api = await h.caller({ accessToken: mgr.session.accessToken });
    const res = await api.users.create({ email: 'Nova@Example.test', name: 'Nová Kolegyně', roles: ['sales'] });
    expect(res.user.email).toBe('nova@example.test');
    expect(res.temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    expect(res.user.totpEnabled).toBe(false);
    expect(
      await code(api.users.create({ email: 'nova@example.test', name: 'Duplicita', roles: ['sales'] })),
    ).toBe('CONFLICT');
  });

  it('změna role platí okamžitě (role se čtou z DB u každého požadavku)', async () => {
    const mgr = await h.onboardUser({ roles: ['manager'] });
    const sales = await h.onboardUser({ roles: ['sales'] });
    const mgrApi = await h.caller({ accessToken: mgr.session.accessToken });
    await mgrApi.users.update({ id: sales.user.id, roles: ['sales', 'manager'] });
    const salesApi = await h.caller({ accessToken: sales.session.accessToken });
    expect((await salesApi.auth.me()).permissions).toContain('users.manage');
  });
});

describe('správa uživatelů – pravidla', () => {
  it('musí zůstat alespoň jeden aktivní manažer', async () => {
    const mgr = await h.onboardUser({ roles: ['manager', 'sales'] });
    const api = await h.caller({ accessToken: mgr.session.accessToken });
    expect(await code(api.users.update({ id: mgr.user.id, roles: ['sales'] }))).toBe('BAD_REQUEST');
    expect(await code(api.users.update({ id: mgr.user.id, isActive: false }))).toBe('BAD_REQUEST');

    const mgr2 = await h.onboardUser({ roles: ['manager'] });
    expect(await code(api.users.update({ id: mgr2.user.id, isActive: false }))).toBe('OK');
  });

  it('nikdo nemůže být sám sobě nadřízeným', async () => {
    const mgr = await h.onboardUser({ roles: ['manager'] });
    const api = await h.caller({ accessToken: mgr.session.accessToken });
    expect(await code(api.users.update({ id: mgr.user.id, supervisorId: mgr.user.id }))).toBe('BAD_REQUEST');
  });

  it('deaktivace okamžitě odhlásí uživatele ze všech zařízení', async () => {
    const mgr = await h.onboardUser({ roles: ['manager'] });
    const sales = await h.onboardUser({ roles: ['sales'] });
    const api = await h.caller({ accessToken: mgr.session.accessToken });
    await api.users.update({ id: sales.user.id, isActive: false });
    expect(await h.services.auth.authenticate(sales.session.accessToken)).toBeNull();
  });

  it('obnovení přístupu: nové dočasné heslo, vypnuté 2FA, odhlášení', async () => {
    const mgr = await h.onboardUser({ roles: ['manager'] });
    const sales = await h.onboardUser({ roles: ['sales'] });
    const api = await h.caller({ accessToken: mgr.session.accessToken });
    const { temporaryPassword } = await api.users.resetCredentials({ id: sales.user.id });
    expect(await h.services.auth.authenticate(sales.session.accessToken)).toBeNull();

    const anon = await h.caller();
    expect(await code(anon.auth.login({ email: sales.email, password: sales.password }))).toBe('UNAUTHORIZED');
    const step = await anon.auth.login({ email: sales.email, password: temporaryPassword });
    expect(step.status).toBe('password_change_required');
    const list = await api.users.list();
    expect(list.find((u) => u.id === sales.user.id)?.totpEnabled).toBe(false);
  });
});
