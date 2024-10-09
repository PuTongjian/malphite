import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import process from "node:process";
import Vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import ElegantVueRouter from "@elegant-router/vue/vite";
// import { setupVitePlugins } from "./build/plugins";


// https://vitejs.dev/config/
export default defineConfig(configEnv => {
  const viteEnv =  loadEnv(configEnv.mode, process.cwd()) as unknown as Env.CustomImportMetaEnv;

  return {
    base: viteEnv.VITE_BASE_URL,
    plugins: [
      Vue(),

      ElegantVueRouter({
        alias: {
          "@": "src",
        },
        layouts: {
          basic: "src/layout/basic-layout/index.vue",
        },
        dtsDir: "typings/elegant-router.d.ts"
      }),

      Components({
        extensions: ["vue"],
        dts: "typings/components.d.ts",
        include: [/\.vue$/, /\.vue\?vue/],
        exclude: [/node_modules/],
        dirs: ["src/components"],
      }),

      UnoCSS()
    ],
    resolve: {
      alias: {
        "~": resolve(__dirname),
        "@": resolve(__dirname, "src")
      }
    }
  };
});
