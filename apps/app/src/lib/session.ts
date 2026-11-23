import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SessionTokens } from '@mtsales/shared';
import { authenticateBiometric, biometricsAvailable } from './biometrics';
import { CLIENT_KIND, IS_WEB, RELOCK_AFTER_MS, TRPC_URL } from './config';
import { secureStorage } from './secureStorage';

/**
 * Stav přihlášení.
 * - loading: zjišťujeme, jestli existuje platná relace
 * - signedOut: přihlašovací obrazovka
 * - locked: iPhone – relace existuje, ale čeká se na Face ID
 * - signedIn: přihlášen
 */
export type SessionStatus = 'loading' | 'signedOut' | 'locked' | 'signedIn';

interface State {
  status: SessionStatus;
  accessToken: string | null;
  accessTokenExpiresAt: number;
}

let state: State = { status: 'loading', accessToken: null, accessTokenExpiresAt: 0 };
const listeners = new Set<() => void>();
const onSignOutCallbacks = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribe, () => state.status, () => state.status);
}

/** Volání auth procedury přímo přes fetch (bez tRPC klienta, aby nevznikla smyčka obnovování). */
async function callAuth<T>(path: 'auth.refresh' | 'auth.logout', input: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${TRPC_URL}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-mtsales-client': CLIENT_KIND },
      body: JSON.stringify(input ?? null),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { data?: T } };
    return json.result?.data ?? null;
  } catch {
    return null;
  }
}

async function applyTokens(tokens: SessionTokens) {
  if (!IS_WEB && tokens.refreshToken) await secureStorage.setRefreshToken(tokens.refreshToken);
  setState({
    status: 'signedIn',
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt).getTime(),
  });
}

let refreshing: Promise<boolean> | null = null;

/** Obnoví přístupový token. Souběžná volání sdílí jeden požadavek. */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = IS_WEB ? undefined : await secureStorage.getRefreshToken();
    if (!IS_WEB && !refreshToken) return false;
    const tokens = await callAuth<SessionTokens>('auth.refresh', IS_WEB ? null : { refreshToken });
    if (!tokens) return false;
    await applyTokens(tokens);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function clearLocal() {
  await secureStorage.clearRefreshToken();
  setState({ status: 'signedOut', accessToken: null, accessTokenExpiresAt: 0 });
  onSignOutCallbacks.forEach((cb) => cb());
}

let backgroundSince: number | null = null;
function handleAppState(next: AppStateStatus) {
  if (IS_WEB) return;
  if (next === 'background') backgroundSince = Date.now();
  if (next === 'active' && backgroundSince !== null) {
    const away = Date.now() - backgroundSince;
    backgroundSince = null;
    if (state.status === 'signedIn' && away > RELOCK_AFTER_MS) {
      void secureStorage.getBiometricLock().then((on) => {
        if (on) setState({ status: 'locked' });
      });
    }
  }
}

export const session = {
  /** Při startu aplikace: obnovit relaci (web z cookie, iPhone z Keychain + Face ID). */
  async bootstrap() {
    AppState.addEventListener('change', handleAppState);
    if (IS_WEB) {
      if (!(await refresh())) await clearLocal();
      return;
    }
    const token = await secureStorage.getRefreshToken();
    if (!token) return clearLocal();
    if (await secureStorage.getBiometricLock()) {
      setState({ status: 'locked' });
      return session.unlock();
    }
    if (!(await refresh())) await clearLocal();
  },

  /** Odemčení Face ID a obnovení relace. */
  async unlock(): Promise<boolean> {
    if (!(await authenticateBiometric())) return false;
    if (await refresh()) return true;
    await clearLocal();
    return false;
  },

  /** Po úspěšném přihlášení. Na iPhonu se Face ID zapne automaticky, pokud je k dispozici. */
  async signIn(tokens: SessionTokens) {
    if (!IS_WEB && (await secureStorage.getBiometricLock()) === null) {
      await secureStorage.setBiometricLock(await biometricsAvailable());
    }
    await applyTokens(tokens);
  },

  async signOut() {
    const refreshToken = IS_WEB ? undefined : await secureStorage.getRefreshToken();
    await callAuth('auth.logout', IS_WEB ? null : { refreshToken });
    await clearLocal();
  },

  /** Přístupový token pro API; pokud brzy vyprší, nejdřív se obnoví. */
  async getAccessToken(): Promise<string | null> {
    if (state.status !== 'signedIn') return null;
    if (state.accessTokenExpiresAt - Date.now() < 60_000) {
      if (!(await refresh())) {
        await clearLocal();
        return null;
      }
    }
    return state.accessToken;
  },

  /** Server vrátil 401 – zkusit jednou obnovit. */
  async handleUnauthorized(): Promise<boolean> {
    if (state.status !== 'signedIn') return false;
    if (await refresh()) return true;
    await clearLocal();
    return false;
  },

  onSignOut(cb: () => void) {
    onSignOutCallbacks.add(cb);
    return () => onSignOutCallbacks.delete(cb);
  },
};
