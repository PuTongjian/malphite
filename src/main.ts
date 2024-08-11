import { createApp } from "vue";
import App from "./App.vue";
import { setupRouter } from "@/router";
import { setupDiscreteApi } from "./utils";

import "virtual:uno.css";
import "@/styles/reset.css";
import "@/styles/global.scss";


function setupApp() {
  const app = createApp(App);
  //初始化路由
  setupRouter(app);
  // 初始化naiveUI discreteApi
  setupDiscreteApi();

  app.mount("#app");
}

setupApp();
