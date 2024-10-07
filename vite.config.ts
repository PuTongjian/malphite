import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { resolve } from "node:path";
import Components from "unplugin-vue-components/vite";
import ElegantVueRouter from "@elegant-router/vue/vite";


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue(),

    ElegantVueRouter({
      alias: {
        "@": "src",
      },
      layouts: {
        basic: "src/layout/basic-layout/index.vue",
      },
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
});
