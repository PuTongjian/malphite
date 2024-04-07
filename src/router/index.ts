import type { App } from "vue";

import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [],
});

export function setupRouter(app: App) {
  app.use(router);
}
