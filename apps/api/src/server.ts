import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';
import type { AppDeps } from './deps';
import { appRouter, type AppRouter } from './router';
import { createServices } from './services';
import type { RequestContext } from './trpc/context';

export const REFRESH_COOKIE = 'mt_rt';
export const TRPC_PREFIX = '/api/trpc';

export async function buildServer(deps: AppDeps) {
  const services = createServices(deps);
  const { config } = deps;

  const app = Fastify({
    trustProxy: true,
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Žádné osobní údaje v logu: bez hlaviček, bez query stringu (tRPC v něm posílá vstupy).
            redact: ['req.headers', 'res.headers'],
            serializers: {
              req: (req) => ({ method: req.method, url: String(req.url).split('?')[0], reqId: req.id }),
            },
          },
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.APP_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-mtsales-client', 'trpc-accept'],
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/health', async () => {
    await deps.db.execute(sql`select 1`);
    return { status: 'ok' };
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: TRPC_PREFIX,
    trpcOptions: {
      router: appRouter,
      async createContext({ req, res }): Promise<RequestContext> {
        const client = req.headers['x-mtsales-client'] === 'native' ? 'native' : 'web';
        const authHeader = req.headers.authorization;
        const user = authHeader?.startsWith('Bearer ')
          ? await services.auth.authenticate(authHeader.slice('Bearer '.length))
          : null;
        const cookieOptions = {
          httpOnly: true,
          secure: config.COOKIE_SECURE,
          sameSite: 'lax' as const,
          path: '/api',
        };
        return {
          deps,
          services,
          client,
          user,
          refreshCookie: {
            get: () => req.cookies[REFRESH_COOKIE],
            set: (token, expiresAt) => void res.setCookie(REFRESH_COOKIE, token, { ...cookieOptions, expires: expiresAt }),
            clear: () => void res.clearCookie(REFRESH_COOKIE, cookieOptions),
          },
        };
      },
      onError({ error, path }) {
        // Jen kód a cesta – nikdy vstupní data.
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          app.log.error({ path, code: error.code, err: error.cause ?? error }, 'tRPC chyba');
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  return { app, services };
}
