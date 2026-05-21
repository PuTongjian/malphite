# 用 Vite 8 + Rolldown 实现 bundle 命令

本文目标：参考 AFFiNE 的 `tools/cli/src/bundle.ts` 思路，在当前仓库中用 Vite 8 实现同类 CLI 构建能力。

Vite 8 已经内置 Rolldown，不需要再使用 `rolldown-vite` 包。实现时应使用 `vite` 包提供的 `build()` / `createServer()` API，并在配置里使用 `build.rolldownOptions`，不要继续写旧的 `build.rollupOptions`。

## 1. 先明确可实现范围

AFFiNE 的 `bundle.ts` 做的是命令分发，真正复杂逻辑在 Rspack 配置工厂里：

- HTML app 构建
- dev server
- 多 worker 独立构建
- Node target 构建
- public assets 拷贝
- define 环境常量
- sourcemap、chunk、文件名规则
- Sentry / vanilla-extract / 上传产物等插件能力

当前仓库建议分阶段实现：

1. 先支持 `@mlphite/web` 的 Vite dev server 和 production build。
2. 再抽象 `createViteHTMLTargetConfig()`。
3. 再补 worker 构建。
4. 最后补 Node target、Sentry、资源上传等高级能力。

不要一开始照搬 AFFiNE 的所有 package 分支。你当前仓库还没有完整 app 源码，先把构建管线跑通更重要。

## 2. 确认依赖

当前 `pnpm-workspace.yaml` 里已经有：

```yaml
catalog:
  vite: ^8.0.14
```

`tools/cli/package.json` 里也已经依赖：

```json
{
  "dependencies": {
    "vite": "catalog:"
  }
}
```

如果后续需要 React，再加对应插件：

```bash
pnpm add -D @vitejs/plugin-react -w
```

如果需要 vanilla-extract：

```bash
pnpm add -D @vanilla-extract/vite-plugin -w
```

如果需要 Sentry：

```bash
pnpm add -D @sentry/vite-plugin -w
```

## 3. 给 Package 增加 srcPath 和 distPath

AFFiNE 代码里使用 `pkg.srcPath` 和 `pkg.distPath`。当前仓库的 `Package` 还没有这两个 getter，需要先补上。

编辑 `tools/utils/src/package.ts`：

```ts
export class Package {
  // ...已有代码

  get srcPath() {
    return this.path.join("src");
  }

  get distPath() {
    return this.path.join("dist");
  }

  join(...paths: string[]) {
    return this.path.join(...paths);
  }
}
```

这样后面的 CLI 构建代码可以统一写成：

```ts
pkg.srcPath.join("index.tsx").value
pkg.distPath.value
```

## 4. 准备 web app 最小入口

先让 `@mlphite/web` 成为一个标准 Vite HTML app。

建议目录：

```text
packages/frontend/app/web/
  index.html
  src/
    index.tsx
```

`packages/frontend/app/web/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Malphite</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

`packages/frontend/app/web/src/index.tsx` 先写最小内容：

```tsx
const root = document.querySelector("#root");

if (root) {
  root.textContent = "Malphite web app";
}
```

如果你后面接 React，再把这里替换成 `createRoot(...).render(...)`。

## 5. 新建 Vite 配置工厂

建议不要把所有 Vite 配置塞进 `bundle.ts`。先建一个独立模块：

```text
tools/cli/src/vite/
  index.ts
```

`tools/cli/src/vite/index.ts`：

```ts
import type { Package } from "@malphite-tools/utils/workspace";
import { ProjectRoot } from "@malphite-tools/utils/path";
import type { UserConfig } from "vite";

export function createViteHTMLTargetConfig(pkg: Package): UserConfig {
  return {
    root: pkg.path.value,
    base: "/",
    publicDir: pkg.join("public").exists() ? pkg.join("public").value : false,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      __PACKAGE_NAME__: JSON.stringify(pkg.name),
    },
    resolve: {
      alias: {
        "@malphite/core": ProjectRoot.join("packages/frontend/core/src").value,
      },
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },
    build: {
      outDir: pkg.distPath.value,
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
      proxy: {
        "/api": {
          target: "http://localhost:3010",
          changeOrigin: true,
        },
        "/graphql": {
          target: "http://localhost:3010",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://localhost:3010",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
}
```

关键点：

- Vite 8 使用 `build.rolldownOptions`。
- `build.rollupOptions` 在 Vite 8 里只是兼容别名，不建议新代码使用。
- `codeSplitting.groups` 是 Rolldown 更接近 webpack `splitChunks` 的分包方式，比 `manualChunks` 更适合后续迁移 AFFiNE 的 cache group 思路。

## 6. 实现 BundleCommand

替换 `tools/cli/src/bundle.ts`：

```ts
import { rmSync } from "node:fs";
import { Logger } from "@malphite-tools/utils/logger";
import type { Package } from "@malphite-tools/utils/workspace";
import { Option } from "clipanion";
import { build, createServer, mergeConfig, type UserConfig } from "vite";
import { PackageCommand } from "./command";
import { createViteHTMLTargetConfig } from "./vite/index";

const VITE_SUPPORTED_PACKAGES = new Set(["@mlphite/web"]);

function assertViteSupportedPackage(pkg: Package) {
  if (VITE_SUPPORTED_PACKAGES.has(pkg.name)) {
    return;
  }

  throw new Error(
    `Vite bundle currently supports: ${Array.from(VITE_SUPPORTED_PACKAGES).join(
      ", ",
    )}. Unsupported package: ${pkg.name}.`,
  );
}

function getViteBundleConfig(pkg: Package): UserConfig {
  assertViteSupportedPackage(pkg);

  switch (pkg.name) {
    case "@mlphite/web":
      return createViteHTMLTargetConfig(pkg);
  }

  throw new Error(`Unsupported package: ${pkg.name}`);
}

export class BundleCommand extends PackageCommand {
  static override paths = [["bundle"], ["pack"], ["bun"]];

  override _deps = false;
  override waitDeps = false;

  dev = Option.Boolean("--dev,-d", false, {
    description: "Run in Development mode",
  });

  async execute() {
    const pkg = this.workspace.getPackage(this.package);

    if (this.dev) {
      await BundleCommand.dev(pkg);
    } else {
      await BundleCommand.build(pkg);
    }
  }

  static async build(pkg: Package) {
    process.env.NODE_ENV = "production";
    assertViteSupportedPackage(pkg);

    const logger = new Logger("bundle");
    logger.info(`Packing package ${pkg.name} with vite 8 / rolldown...`);
    logger.info("Cleaning old output...");

    rmSync(pkg.distPath.value, { recursive: true, force: true });

    await build(getViteBundleConfig(pkg));
  }

  static async dev(pkg: Package, devServerConfig: UserConfig = {}) {
    process.env.NODE_ENV = "development";
    assertViteSupportedPackage(pkg);

    const logger = new Logger("bundle");
    logger.info(`Starting vite 8 dev server for ${pkg.name}...`);

    const server = await createServer(
      mergeConfig(getViteBundleConfig(pkg), devServerConfig),
    );

    await server.listen();
    server.printUrls();
  }
}
```

这里等价于 AFFiNE 的命令分发：

- `BundleCommand.build()` 对应原来的 `buildWithRspack()`
- `BundleCommand.dev()` 对应原来的 `devWithRspack()`
- `getViteBundleConfig()` 对应原来的 `getRspackBundleConfigs()`

区别是 Vite 的 programmatic API 更简单，不需要手动创建 compiler。

## 7. 跑构建

执行：

```bash
pnpm malphite bundle -p @mlphite/web
```

预期产物：

```text
packages/frontend/app/web/dist/
  index.html
  js/
  assets/
  .vite/manifest.json
```

如果报 `index.html` 不存在，说明第 4 步没有补齐入口。

如果报 alias 找不到，先确认：

```text
packages/frontend/core/src
```

是否存在。当前仓库的 `@malphite/core` 还没有源码时，可以先删除 alias，等 core 有源码后再加回来。

## 8. 跑 dev server

执行：

```bash
pnpm malphite bundle -p @mlphite/web --dev
```

Vite 会打印本地访问地址。默认 host 是 `0.0.0.0`，方便局域网或容器访问。

## 9. 增加 worker 构建

AFFiNE 是把 worker 当独立 target 构建的。Vite 有两种做法。

### 方案 A：源码内直接使用 Worker

如果业务代码可以改，优先这样写：

```ts
const worker = new Worker(new URL("./example.worker.ts", import.meta.url), {
  type: "module",
});
```

然后在 Vite 配置里加：

```ts
worker: {
  format: "es",
  rolldownOptions: {
    output: {
      entryFileNames: "js/[name].[hash].worker.js",
    },
  },
},
```

这种方式最符合 Vite。

### 方案 B：像 AFFiNE 一样单独构建 worker 文件

如果你必须得到固定文件名的 worker 产物，可以做独立配置工厂：

```ts
import path from "node:path";
import type { Package } from "@malphite-tools/utils/workspace";
import type { UserConfig } from "vite";

export function createViteWorkerTargetConfig(
  pkg: Package,
  entry: string,
): UserConfig {
  const workerName = path.basename(entry).replace(/\.worker\.ts$/, "");

  return {
    root: pkg.path.value,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      outDir: pkg.distPath.value,
      emptyOutDir: false,
      sourcemap: true,
      target: "es2022",
      lib: {
        entry,
        formats: ["es"],
        fileName: () => `js/${workerName}.worker.js`,
      },
      rolldownOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
}
```

然后在 `BundleCommand.build()` 中：

```ts
await build(getViteBundleConfig(pkg));

await build(
  createViteWorkerTargetConfig(
    pkg,
    pkg.srcPath.join("example.worker.ts").value,
  ),
);
```

注意：独立 worker 构建需要你自己管理主应用里如何引用最终 worker 文件名。如果希望 hash 文件名可追踪，建议打开 `manifest` 后读取 `.vite/manifest.json`。

## 10. 增加 Node target

如果后续要支持类似 AFFiNE 的 `@affine/server`，可以增加：

```ts
import type { Package } from "@malphite-tools/utils/workspace";
import type { UserConfig } from "vite";

export function createViteNodeTargetConfig(pkg: Package, entry: string): UserConfig {
  return {
    root: pkg.path.value,
    build: {
      outDir: pkg.distPath.value,
      emptyOutDir: true,
      sourcemap: true,
      target: "node22",
      ssr: entry,
      rolldownOptions: {
        external: [
          "node:fs",
          "node:path",
          "node:url",
        ],
        output: {
          entryFileNames: "main.js",
          format: pkg.packageJson.type === "module" ? "es" : "cjs",
        },
      },
    },
  };
}
```

Node target 的迁移要单独验证：

- 是否需要 external 掉所有普通 npm 依赖
- 是否需要打包 workspace 依赖
- 是否有 `.node` 原生模块
- 是否依赖 legacy decorators

这些都不是 HTML app 构建能自动解决的。

## 11. 对照 AFFiNE 能力迁移

| AFFiNE / Rspack 能力 | Vite 8 / Rolldown 对应做法 |
| --- | --- |
| `rspack(config)` | `vite.build(config)` |
| `RspackDevServer` | `vite.createServer(config)` |
| `entry` | `build.rolldownOptions.input` 或 HTML script |
| `output.filename` | `build.rolldownOptions.output.entryFileNames` |
| `assetModuleFilename` | `build.rolldownOptions.output.assetFileNames` |
| `DefinePlugin` | `define` |
| `CopyRspackPlugin` | `publicDir` 或静态复制插件 |
| `splitChunks.cacheGroups` | `output.codeSplitting.groups` |
| worker 独立 target | `worker.rolldownOptions` 或多次 `vite.build()` |
| Node target | `build.ssr` + `rolldownOptions.external/output` |
| `rollupOptions` | 不建议使用，改为 `rolldownOptions` |

## 12. 验证清单

每完成一个阶段，按这个顺序验：

```bash
pnpm typecheck
pnpm malphite bundle -p @mlphite/web
pnpm malphite bundle -p @mlphite/web --dev
```

如果 `typecheck` 先失败，优先修类型。CLI 类型不稳时，后面的构建问题会很难判断。

## 13. 常见坑

### 不要安装 rolldown-vite

Vite 8 已经集成 Rolldown。`rolldown-vite` 是 Vite 6/7 时代的过渡包。

### 不要新写 build.rollupOptions

Vite 8 仍兼容 `build.rollupOptions`，但它已经是 `build.rolldownOptions` 的别名。新代码直接写 `rolldownOptions`。

### manualChunks 可以用，但优先 codeSplitting

Rolldown 兼容一部分 Rollup 配置，但迁移 webpack/Rspack 的 chunk group 时，`codeSplitting.groups` 更贴近原模型。旧资料可能会提到 `advancedChunks`，新迁移请优先按 Vite 8 迁移说明使用 `codeSplitting`。

### worker 插件要写在 worker.plugins

Vite 文档明确说明：普通 `config.plugins` 在 build worker 时不等同于 worker bundle 插件。需要 worker 构建插件时，用：

```ts
worker: {
  plugins: () => [
    // new plugin instances
  ],
}
```

### define 的对象行为和旧工具链不同

Vite 8 使用 Oxc/Rolldown 工具链。复杂对象 define 不要依赖引用共享，尽量定义简单常量或 JSON 字符串。

## 14. 推荐最终文件结构

```text
tools/cli/src/
  bundle.ts
  vite/
    index.ts
    html.ts
    worker.ts
    node.ts
    shared.ts
```

第一版可以只放 `vite/index.ts`。等配置变多后再拆成 `html.ts`、`worker.ts`、`node.ts`。

## 参考资料

- Vite 8 发布说明：https://vite.dev/blog/announcing-vite8
- Vite 8 build options：https://main.vite.dev/config/build-options
- Vite worker options：https://vite.dev/config/worker-options
- Vite shared options：https://vite.dev/config/shared-options/
- Vite 7 到 8 迁移说明：https://vite.dev/guide/migration
