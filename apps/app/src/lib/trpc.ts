import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpLink, TRPCClientError } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@mtsales/api/router';
import { cs } from '@mtsales/shared';
import { CLIENT_KIND, TRPC_URL } from './config';
import { session } from './session';

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        // Chyby oprávnění a validace nemá smysl opakovat.
        if (error instanceof TRPCClientError && error.data?.httpStatus && error.data.httpStatus < 500) return false;
        return count < 2;
      },
    },
  },
});
session.onSignOut(() => queryClient.clear());

const isAuthCall = (path: string) => path.startsWith('auth.') && path !== 'auth.me';

/** fetch, který při 401 jednou obnoví token a požadavek zopakuje. */
const fetchWithRefresh: typeof fetch = async (input, init) => {
  const doFetch = async () => {
    const headers = new Headers(init?.headers);
    const token = await session.getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: 'include' });
  };
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = decodeURIComponent(new URL(url, 'http://x').pathname.split('/').pop() ?? '');
  if (isAuthCall(path)) return fetch(input, { ...init, credentials: 'include' });
  const res = await doFetch();
  if (res.status === 401 && (await session.handleUnauthorized())) return doFetch();
  return res;
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: TRPC_URL,
      headers: () => ({ 'x-mtsales-client': CLIENT_KIND }),
      fetch: fetchWithRefresh,
    }),
  ],
});

/** Česká chybová hláška pro uživatele. */
export function errorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    // Chyby validace vstupu (Zod) mají v message JSON – uživateli ukážeme obecnou hlášku.
    if (error.data?.code === 'BAD_REQUEST' && error.message.trim().startsWith('[')) return 'Zkontrolujte zadané údaje.';
    if (error.message && error.data) return error.message;
  }
  return cs.common.unknownError;
}
