import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue(),

    Components({
      extensions: ["vue"],
      dts: "src/types/components.d.ts",
      include: [/\.vue$/, /\.vue\?vue/],
      exclude: [/node_modules/],
      dirs: ["src/components"]
    }),
  ],
});
