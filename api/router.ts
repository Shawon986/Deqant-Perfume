import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { storeRouter } from "./store-router";
import { adminRouter } from "./admin-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  store: storeRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
