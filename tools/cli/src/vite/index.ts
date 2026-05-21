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
  };
}
