import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { totp } from './lib/totp';
import { buildServer, REFRESH_COOKIE, TRPC_PREFIX } from './server';
import { createHarness, type Harness } from './test/harness';

let h: Harness;
let app: Awaited<ReturnType<typeof buildServer>>['app'];
beforeEach(async () => {
  h = await createHarness();
  app = (await buildServer(h.deps)).app;
});
afterEach(async () => {
  await app.close();
  await h.close();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({
    method: 'POST',
    url: `${TRPC_PREFIX}/${path}`,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:8081', ...headers },
    payload: JSON.stringify(body),
  });

describe('HTTP server', () => {
  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('CORS povolí jen nastavený původ', async () => {
    const ok = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:8081' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const bad = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('celé přihlášení přes HTTP (web): httpOnly cookie, obnovení, odhlášení', async () => {
    const { temporaryPassword } = await h.services.users.create(
      { email: 'web@example.test', name: 'Webový Uživatel', roles: ['manager'] },
      null,
    );
    const s1 = (await post('auth.login', { email: 'web@example.test', password: temporaryPassword })).json();
    const s2 = (
      await post('auth.changeInitialPassword', {
        onboardingToken: s1.result.data.onboardingToken,
        newPassword: 'webove-heslo-12345',
      })
    ).json();
    const token = s2.result.data.onboardingToken;
    const setup = (await post('auth.totpSetupStart', { onboardingToken: token })).json().result.data;
    const confirm = await post('auth.totpSetupConfirm', {
      onboardingToken: token,
      code: totp(setup.secret, h.clock.now()),
    });
    expect(confirm.statusCode).toBe(200);
    const cookie = confirm.cookies.find((c) => c.name === REFRESH_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/api');
    expect(confirm.json().result.data.session.refreshToken).toBeUndefined();

    const access = confirm.json().result.data.session.accessToken;
    const me = await app.inject({
      method: 'GET',
      url: `${TRPC_PREFIX}/auth.me`,
      headers: { authorization: `Bearer ${access}` },
    });
    expect(me.json().result.data.email).toBe('web@example.test');

    const refreshed = await post('auth.refresh', null, { cookie: `${REFRESH_COOKIE}=${cookie!.value}` });
    expect(refreshed.statusCode).toBe(200);
    const newCookie = refreshed.cookies.find((c) => c.name === REFRESH_COOKIE);
    expect(newCookie?.value).not.toBe(cookie!.value);

    const out = await post('auth.logout', null, { cookie: `${REFRESH_COOKIE}=${newCookie!.value}` });
    expect(out.statusCode).toBe(200);
    const again = await post('auth.refresh', null, { cookie: `${REFRESH_COOKIE}=${newCookie!.value}` });
    expect(again.statusCode).toBe(401);
  });

  it('chybné přihlášení vrací 401 s českou hláškou', async () => {
    const res = await post('auth.login', { email: 'nikdo@example.test', password: 'x' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Nesprávný e-mail nebo heslo.');
  });
});
