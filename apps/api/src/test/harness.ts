import { sql } from 'drizzle-orm';
import { createDb, runMigrations, type Db } from '@mtsales/db';
import type { Role } from '@mtsales/shared';
import type { Config } from '../config';
import type { AppDeps } from '../deps';
import { TokenService } from '../lib/tokens';
import { totp } from '../lib/totp';
import { appRouter } from '../router';
import { createServices } from '../services';
import type { ClientKind, RequestContext } from '../trpc/context';

export const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://mtsales:mtsales@localhost:5432/mtsales_test';

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  DATABASE_URL: TEST_DB_URL,
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  APP_ORIGINS: 'http://localhost:8081',
  COOKIE_SECURE: false,
  LOG_LEVEL: 'silent',
};

let migrated = false;

/** Řízený čas pro testy. */
export class Clock {
  constructor(private current = new Date('2026-11-23T09:00:00+01:00')) {}
  now = () => new Date(this.current);
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class CookieJar {
  value: string | undefined;
  get = () => this.value;
  set = (token: string) => {
    this.value = token;
  };
  clear = () => {
    this.value = undefined;
  };
}

export async function createHarness() {
  if (!migrated) {
    await runMigrations(TEST_DB_URL);
    migrated = true;
  }
  const { db, close } = createDb(TEST_DB_URL, { max: 3 });
  await db.execute(
    sql`TRUNCATE audit_events, sessions, recovery_codes, user_roles, users RESTART IDENTITY CASCADE`,
  );
  const clock = new Clock();
  const deps: AppDeps = {
    db: db as Db,
    config: testConfig,
    tokens: new TokenService(testConfig.JWT_SECRET, clock.now),
    now: clock.now,
  };
  const services = createServices(deps);

  async function caller(options: { client?: ClientKind; accessToken?: string; jar?: CookieJar } = {}) {
    const jar = options.jar ?? new CookieJar();
    const user = options.accessToken ? await services.auth.authenticate(options.accessToken) : null;
    const ctx: RequestContext = {
      deps,
      services,
      client: options.client ?? 'web',
      user,
      refreshCookie: jar,
    };
    return appRouter.createCaller(ctx);
  }

  /** Založí uživatele a projde celým prvním přihlášením (heslo + Authenticator). */
  async function onboardUser(params: {
    email?: string;
    name?: string;
    roles?: Role[];
    password?: string;
    client?: ClientKind;
  }) {
    const email = params.email ?? `user${Math.random().toString(36).slice(2, 8)}@example.test`;
    const password = params.password ?? 'velmi-dlouhe-heslo-123';
    const { user, temporaryPassword } = await services.users.create(
      { email, name: params.name ?? 'Test Uživatel', roles: params.roles ?? ['sales'] },
      null,
    );
    const api = await caller({ client: params.client ?? 'native' });
    const step1 = await api.auth.login({ email, password: temporaryPassword });
    if (step1.status !== 'password_change_required') throw new Error('očekávána změna hesla');
    const step2 = await api.auth.changeInitialPassword({
      onboardingToken: step1.onboardingToken,
      newPassword: password,
    });
    if (step2.status !== 'totp_setup_required') throw new Error('očekáváno nastavení TOTP');
    const setup = await api.auth.totpSetupStart({ onboardingToken: step2.onboardingToken });
    const confirmed = await api.auth.totpSetupConfirm({
      onboardingToken: step2.onboardingToken,
      code: totp(setup.secret, clock.now()),
    });
    return { user, email, password, secret: setup.secret, ...confirmed };
  }

  return { db, deps, services, clock, caller, onboardUser, close };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
