import { TRPCError } from '@trpc/server';
import {
  changeInitialPasswordInput,
  cs,
  loginInput,
  refreshInput,
  totpSetupConfirmInput,
  totpSetupStartInput,
  totpVerifyInput,
  type SessionTokens,
} from '@mtsales/shared';
import type { RequestContext } from '../../trpc/context';
import { authedProcedure, publicProcedure, router } from '../../trpc/init';
import type { IssuedSession } from './auth.service';

/** Web dostane obnovovací token v httpOnly cookie, nativní aplikace v odpovědi (uloží si ho do Keychain). */
function deliver(ctx: RequestContext, issued: IssuedSession): SessionTokens {
  const base = { accessToken: issued.accessToken, accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString() };
  if (ctx.client === 'web') {
    ctx.refreshCookie.set(issued.refreshToken, issued.refreshTokenExpiresAt);
    return base;
  }
  return { ...base, refreshToken: issued.refreshToken };
}

function rawRefreshToken(ctx: RequestContext, fromBody?: string): string {
  const token = ctx.client === 'web' ? ctx.refreshCookie.get() : fromBody;
  if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: cs.auth.sessionExpired });
  return token;
}

export const authRouter = router({
  login: publicProcedure.input(loginInput).mutation(({ ctx, input }) => ctx.services.auth.login(input)),

  changeInitialPassword: publicProcedure
    .input(changeInitialPasswordInput)
    .mutation(({ ctx, input }) => ctx.services.auth.changeInitialPassword(input)),

  totpSetupStart: publicProcedure
    .input(totpSetupStartInput)
    .mutation(({ ctx, input }) => ctx.services.auth.totpSetupStart(input)),

  totpSetupConfirm: publicProcedure.input(totpSetupConfirmInput).mutation(async ({ ctx, input }) => {
    const { session, recoveryCodes } = await ctx.services.auth.totpSetupConfirm(input, ctx.client);
    return { session: deliver(ctx, session), recoveryCodes };
  }),

  totpVerify: publicProcedure.input(totpVerifyInput).mutation(async ({ ctx, input }) => {
    return deliver(ctx, await ctx.services.auth.totpVerify(input, ctx.client));
  }),

  refresh: publicProcedure.input(refreshInput).mutation(async ({ ctx, input }) => {
    try {
      return deliver(ctx, await ctx.services.auth.refresh(rawRefreshToken(ctx, input?.refreshToken), ctx.client));
    } catch (err) {
      if (ctx.client === 'web') ctx.refreshCookie.clear();
      throw err;
    }
  }),

  logout: publicProcedure.input(refreshInput).mutation(async ({ ctx, input }) => {
    const token = ctx.client === 'web' ? ctx.refreshCookie.get() : input?.refreshToken;
    if (token) await ctx.services.auth.logout(token);
    if (ctx.client === 'web') ctx.refreshCookie.clear();
    return { ok: true as const };
  }),

  me: authedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    roles: ctx.user.roles,
    permissions: [...ctx.user.permissions],
  })),
});
