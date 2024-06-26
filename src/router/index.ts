import type { App } from "vue";
import { constantRoutes } from "./routes";
import { transformToVueRoute } from "./utils";

import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: transformToVueRoute(constantRoutes)
});

export function setupRouter(app: App) {
  app.use(router);
}
