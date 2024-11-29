import type { App } from "vue";
import { createBuiltinVueRoutes } from "./routes/builtin";

import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: createBuiltinVueRoutes()
});

export function setupRouter(app: App) {
  app.use(router);
}
