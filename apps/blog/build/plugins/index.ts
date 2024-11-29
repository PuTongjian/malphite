import type { PluginOption } from "vite";

import { setupUnocss } from "./unocss";

export function setupVitePlugins(): PluginOption {
  return [
    setupUnocss(),
  ];
}
