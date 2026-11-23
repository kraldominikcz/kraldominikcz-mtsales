import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditEvents, sessions, users } from '@mtsales/db';
import { cs } from '@mtsales/shared';
import { CookieJar, createHarness, type Harness } from '../../test/harness';
import { totp } from '../../lib/totp';
import { LOCK_THRESHOLD, REFRESH_REUSE_GRACE_SECONDS } from './auth.service';

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});

async function expectTrpcError(promise: Promise<unknown>, code: TRPCError['code'], message?: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe(code);
  if (message) expect((err as TRPCError).message).toBe(message);
}

describe('první přihlášení', () => {
  it('dočasné heslo → nové heslo → Authenticator → relace + 10 záložních kódů', async () => {
    const onboarded = await h.onboardUser({ roles: ['sales'] });
    expect(onboarded.recoveryCodes).toHaveLength(10);
    expect(onboarded.session.accessToken).toBeTruthy();
    expect(onboarded.session.refreshToken).toBeTruthy(); // nativní klient

    const api = await h.caller({ accessToken: onboarded.session.accessToken });
    const me = await api.auth.me();
    expect(me.email).toBe(onboarded.email);
    expect(me.roles).toEqual(['sales']);
    expect(me.permissions).not.toContain('users.manage');
  });

  it('nové heslo nesmí být stejné jako dočasné', async () => {
    const { temporaryPassword } = await h.services.users.create(
      { email: 'a@example.test', name: 'Anna', roles: ['sales'] },
      null,
    );
    const api = await h.caller();
    const step = await api.auth.login({ email: 'a@example.test', password: temporaryPassword });
    if (step.status !== 'password_change_required') throw new Error();
    await expectTrpcError(
      api.auth.changeInitialPassword({ onboardingToken: step.onboardingToken, newPassword: temporaryPassword }),
      'BAD_REQUEST',
    );
  });

  it('špatný kód při nastavení Authenticatoru neprojde', async () => {
    const { temporaryPassword } = await h.services.users.create(
      { email: 'b@example.test', name: 'Bára', roles: ['sales'] },
      null,
    );
    const api = await h.caller();
    const s1 = await api.auth.login({ email: 'b@example.test', password: temporaryPassword });
    if (s1.status !== 'password_change_required') throw new Error();
    const s2 = await api.auth.changeInitialPassword({
      onboardingToken: s1.onboardingToken,
      newPassword: 'nove-dlouhe-heslo-1',
    });
    if (s2.status !== 'totp_setup_required') throw new Error();
    await api.auth.totpSetupStart({ onboardingToken: s2.onboardingToken });
    await expectTrpcError(
      api.auth.totpSetupConfirm({ onboardingToken: s2.onboardingToken, code: '000000' }),
      'UNAUTHORIZED',
      cs.auth.totpInvalid,
    );
  });

  it('onboarding token po 30 minutách vyprší', async () => {
    const { temporaryPassword } = await h.services.users.create(
      { email: 'c@example.test', name: 'Cyril', roles: ['sales'] },
      null,
    );
    const api = await h.caller();
    const s1 = await api.auth.login({ email: 'c@example.test', password: temporaryPassword });
    if (s1.status !== 'password_change_required') throw new Error();
    h.clock.advance(31 * 60_000);
    await expectTrpcError(
      api.auth.changeInitialPassword({ onboardingToken: s1.onboardingToken, newPassword: 'nove-dlouhe-heslo-1' }),
      'UNAUTHORIZED',
    );
  });
});

describe('běžné přihlášení', () => {
  it('heslo + kód z Authenticatoru; stejný kód nejde použít dvakrát', async () => {
    const u = await h.onboardUser({});
    h.clock.advance(60_000); // nový časový krok
    const api = await h.caller();
    const step = await api.auth.login({ email: u.email, password: u.password });
    expect(step.status).toBe('totp_required');
    if (step.status !== 'totp_required') throw new Error();
    const code = totp(u.secret, h.clock.now());
    const tokens = await api.auth.totpVerify({ challengeToken: step.challengeToken, code });
    expect(tokens.accessToken).toBeTruthy();

    const step2 = await api.auth.login({ email: u.email, password: u.password });
    if (step2.status !== 'totp_required') throw new Error();
    await expectTrpcError(api.auth.totpVerify({ challengeToken: step2.challengeToken, code }), 'UNAUTHORIZED');
  });

  it('záložní kód funguje právě jednou', async () => {
    const u = await h.onboardUser({});
    const api = await h.caller();
    const recoveryCode = u.recoveryCodes[0]!;
    const s1 = await api.auth.login({ email: u.email, password: u.password });
    if (s1.status !== 'totp_required') throw new Error();
    await api.auth.totpVerify({ challengeToken: s1.challengeToken, recoveryCode: recoveryCode.toUpperCase() });

    const s2 = await api.auth.login({ email: u.email, password: u.password });
    if (s2.status !== 'totp_required') throw new Error();
    await expectTrpcError(api.auth.totpVerify({ challengeToken: s2.challengeToken, recoveryCode }), 'UNAUTHORIZED');
  });

  it('neznámý e-mail a špatné heslo vrací stejnou chybu', async () => {
    const u = await h.onboardUser({});
    const api = await h.caller();
    await expectTrpcError(
      api.auth.login({ email: 'nikdo@example.test', password: 'cokoli' }),
      'UNAUTHORIZED',
      cs.auth.invalidCredentials,
    );
    await expectTrpcError(
      api.auth.login({ email: u.email, password: 'spatne-heslo' }),
      'UNAUTHORIZED',
      cs.auth.invalidCredentials,
    );
  });

  it(`po ${LOCK_THRESHOLD} neúspěších se účet na 15 minut zablokuje`, async () => {
    const u = await h.onboardUser({});
    const api = await h.caller();
    for (let i = 0; i < LOCK_THRESHOLD; i++) {
      await expectTrpcError(api.auth.login({ email: u.email, password: 'spatne' }), 'UNAUTHORIZED');
    }
    await expectTrpcError(
      api.auth.login({ email: u.email, password: u.password }),
      'TOO_MANY_REQUESTS',
      cs.auth.accountLocked,
    );
    h.clock.advance(16 * 60_000);
    const ok = await api.auth.login({ email: u.email, password: u.password });
    expect(ok.status).toBe('totp_required');
  });

  it('deaktivovaný uživatel se nepřihlásí', async () => {
    const u = await h.onboardUser({});
    await h.db.update(users).set({ isActive: false }).where(eq(users.email, u.email));
    const api = await h.caller();
    await expectTrpcError(api.auth.login({ email: u.email, password: u.password }), 'FORBIDDEN');
    expect(await h.services.auth.authenticate(u.session.accessToken)).toBeNull();
  });
});

describe('relace a obnovení tokenu', () => {
  it('web: obnovovací token je jen v cookie, ne v odpovědi', async () => {
    const u = await h.onboardUser({});
    const jar = new CookieJar();
    const api = await h.caller({ client: 'web', jar });
    const s = await api.auth.login({ email: u.email, password: u.password });
    if (s.status !== 'totp_required') throw new Error();
    h.clock.advance(30_000);
    const tokens = await api.auth.totpVerify({ challengeToken: s.challengeToken, code: totp(u.secret, h.clock.now()) });
    expect(tokens.refreshToken).toBeUndefined();
    expect(jar.value).toBeTruthy();

    const before = jar.value;
    const refreshed = await api.auth.refresh();
    expect(refreshed.accessToken).toBeTruthy();
    expect(jar.value).not.toBe(before); // rotace
  });

  it('rotace: starý token po uplynutí tolerance = podezření na krádež → odhlášení všude', async () => {
    const u = await h.onboardUser({ client: 'native' });
    const api = await h.caller({ client: 'native' });
    const first = u.session.refreshToken!;
    const second = await api.auth.refresh({ refreshToken: first });
    expect(second.refreshToken).toBeTruthy();

    h.clock.advance((REFRESH_REUSE_GRACE_SECONDS + 1) * 1000);
    await expectTrpcError(api.auth.refresh({ refreshToken: first }), 'UNAUTHORIZED');
    // I nový token je teď zneplatněný.
    await expectTrpcError(api.auth.refresh({ refreshToken: second.refreshToken! }), 'UNAUTHORIZED');
    expect(await h.services.auth.authenticate(second.accessToken)).toBeNull();

    const audit = await h.db.select().from(auditEvents).where(eq(auditEvents.action, 'auth.refresh_reuse_detected'));
    expect(audit).toHaveLength(1);
  });

  it('souběžné obnovení v toleranci neodhlásí uživatele', async () => {
    const u = await h.onboardUser({ client: 'native' });
    const api = await h.caller({ client: 'native' });
    const first = u.session.refreshToken!;
    const second = await api.auth.refresh({ refreshToken: first });
    await expectTrpcError(api.auth.refresh({ refreshToken: first }), 'UNAUTHORIZED');
    const third = await api.auth.refresh({ refreshToken: second.refreshToken! });
    expect(third.accessToken).toBeTruthy();
  });

  it('webový token nejde použít z nativní aplikace a naopak', async () => {
    const u = await h.onboardUser({ client: 'native' });
    const web = await h.caller({ client: 'web', jar: Object.assign(new CookieJar(), { value: u.session.refreshToken }) });
    await expectTrpcError(web.auth.refresh(), 'UNAUTHORIZED');
  });

  it('obnovovací token vyprší po 30 dnech nečinnosti', async () => {
    const u = await h.onboardUser({ client: 'native' });
    const api = await h.caller({ client: 'native' });
    h.clock.advance(31 * 86_400_000);
    await expectTrpcError(api.auth.refresh({ refreshToken: u.session.refreshToken! }), 'UNAUTHORIZED');
  });

  it('odhlášení zneplatní relaci i přístupový token', async () => {
    const u = await h.onboardUser({ client: 'native' });
    const api = await h.caller({ client: 'native' });
    await api.auth.logout({ refreshToken: u.session.refreshToken! });
    expect(await h.services.auth.authenticate(u.session.accessToken)).toBeNull();
    const rows = await h.db.select().from(sessions);
    expect(rows.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('přístupový token po 15 minutách vyprší', async () => {
    const u = await h.onboardUser({});
    h.clock.advance(16 * 60_000);
    expect(await h.services.auth.authenticate(u.session.accessToken)).toBeNull();
  });
});

describe('GDPR: audit log bez osobních údajů', () => {
  it('v audit logu nejsou e-maily ani jména', async () => {
    const u = await h.onboardUser({ email: 'jan.novak@example.test', name: 'Jan Novák' });
    const api = await h.caller();
    await api.auth.login({ email: 'jan.novak@example.test', password: 'spatne' }).catch(() => {});
    await api.auth.login({ email: 'neznamy@example.test', password: 'spatne' }).catch(() => {});
    const dump = JSON.stringify(await h.db.select().from(auditEvents));
    expect(dump).not.toContain('jan.novak');
    expect(dump).not.toContain('neznamy');
    expect(dump).not.toContain('Novák');
    expect(dump).not.toContain(u.password);
  });
});
