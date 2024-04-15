import { createApp } from "vue";
import App from "./App.vue";
import { setupRouter } from "@/router";


function setupApp() {
  const app = createApp(App);
  //初始化路由
  setupRouter(app);

  app.mount("#app");
}

setupApp();
