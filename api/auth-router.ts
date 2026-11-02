import { createRouter, authedQuery } from "./middleware";

export const authRouter = createRouter({
  me: authedQuery.query(({ ctx }) => ({ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, avatar: ctx.user.avatar, role: ctx.user.role })),
  logout: authedQuery.mutation(async () => ({ success: true })), 
});
