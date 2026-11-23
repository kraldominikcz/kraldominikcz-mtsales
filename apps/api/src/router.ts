import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { router } from './trpc/init';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
