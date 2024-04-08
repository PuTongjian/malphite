import type { App } from "vue";
import { routes } from "@/router/routes";
import { transformToVueRoute } from "./helpers/route-helper";

import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: transformToVueRoute(routes),
});

export function setupRouter(app: App) {
  app.use(router);
}
