import { createUserInput, updateUserInput, userIdInput } from '@mtsales/shared';
import { permissionProcedure, router } from '../../trpc/init';

export const usersRouter = router({
  list: permissionProcedure('users.read').query(({ ctx }) => ctx.services.users.list()),

  create: permissionProcedure('users.manage')
    .input(createUserInput)
    .mutation(({ ctx, input }) => ctx.services.users.create(input, ctx.user!.id)),

  update: permissionProcedure('users.manage')
    .input(updateUserInput)
    .mutation(({ ctx, input }) => ctx.services.users.update(input, ctx.user!.id)),

  resetCredentials: permissionProcedure('users.manage')
    .input(userIdInput)
    .mutation(({ ctx, input }) => ctx.services.users.resetCredentials(input.id, ctx.user!.id)),
});
