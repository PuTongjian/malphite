import { createApp } from "vue";
import App from "./App.vue";
import { setupRouter } from "@/router";
import { setupDiscreteApi } from "./utils";
import NaiveUi from "naive-ui";

import "virtual:uno.css";
import "@/styles/reset.css";
import "@/styles/global.scss";


function setupApp() {
  const app = createApp(App);
  //初始化路由
  setupRouter(app);
  // 初始化naiveUI discreteApi
  setupDiscreteApi();
  app.use(NaiveUi);

  app.mount("#app");
}

setupApp();
