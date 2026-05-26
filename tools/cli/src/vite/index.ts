import type { Package } from "@malphite-tools/utils/workspace";
import type { UserConfig } from "vite";

export function ceateHTMLTargetConfig(pkg: Package): UserConfig {
  return {
    root: pkg.path.value,
    base: "/",
    publicDir: pkg.join("public").exists() ? pkg.join("public").value : false,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      __PACKAGE_NAME__: JSON.stringify(pkg.name),
    },
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },
    build: {
      outDir: pkg.join("dist").value,
      emptyOutDir: false,
      sourcemap: true,
      target: "es2022",
      manifest: true,
      rolldownOptions: {
        input: pkg.join("index.html").value,
        output: {
          entryFileNames: "js/[name].[hash].js",
          chunkFileNames: "js/[name].[hash].js",
          assetFileNames: "assets/[name].[hash][extname]",
          codeSplitting: {
            groups: [
              {
                name: "vendor",
                test: /[/\\]node_modules[/\\]/,
              },
            ],
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      strictPort: false,
      // proxy: {
      //   "/api": {
      //     target: "http://localhost:3010",
      //     changeOrigin: true,
      //   },
      //   "/graphql": {
      //     target: "http://localhost:3010",
      //     changeOrigin: true,
      //   },
      //   "/socket.io": {
      //     target: "http://localhost:3010",
      //     ws: true,
      //     changeOrigin: true,
      //   },
      // },
    },
  };
}
