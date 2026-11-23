import { initTRPC, TRPCError } from '@trpc/server';
import { cs } from '@mtsales/shared';
import type { Permission } from '@mtsales/domain';
import type { RequestContext } from './context';

const t = initTRPC.context<RequestContext>().create({
  errorFormatter({ shape, error, ctx }) {
    // Interní chyby (500) nikdy neukazujeme klientovi v detailu.
    const isInternal = error.code === 'INTERNAL_SERVER_ERROR';
    const hideDetails = isInternal && ctx?.deps.config.NODE_ENV === 'production';
    return {
      ...shape,
      message: hideDetails ? cs.common.unknownError : shape.message,
      data: { ...shape.data, stack: undefined },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: cs.auth.sessionExpired });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export function permissionProcedure(permission: Permission) {
  return authedProcedure.use(({ ctx, next }) => {
    if (!ctx.user.permissions.has(permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: cs.errors.forbidden });
    }
    return next();
  });
}
