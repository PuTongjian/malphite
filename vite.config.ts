import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { resolve } from "node:path";
import Components from "unplugin-vue-components/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue(),

    Components({
      extensions: ["vue"],
      dts: "src/typings/components.d.ts",
      include: [/\.vue$/, /\.vue\?vue/],
      exclude: [/node_modules/],
      dirs: ["src/components"]
    }),

    UnoCSS()
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    }
  }
});
