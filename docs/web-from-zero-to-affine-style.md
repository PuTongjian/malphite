# 从当前项目继续靠近 AFFiNE

这份计划直接覆盖旧计划，不在旧第 13 节后面继续追加。

当前项目已经不是“从 DOM 到 React”的阶段了。现在更像一个 AFFiNE 架构的 toy model：入口、LiveData、Framework provider、workspace scope、doc service、localStorage driver、workspace 路由和最小 workbench service 都已经出现。

下一步不要急着复制 AFFiNE 的 `nbstore`、BlockSuite、Yjs 或完整 Workbench。要像 Karpathy 式学习一样：先做最小版本，让抽象自己长出来，然后再读真实源码。AFFiNE 很大，但它的浏览器应用主线可以先压缩成这一条：

```text
web app bootstrap
  -> root framework provider
  -> platform impls
  -> workspace list
  -> open workspace ref
  -> workspace scope
  -> workspace services
  -> workbench root
  -> view router
  -> storage worker
```

当前项目的主线应该逐步变成：

```text
setup
  -> LiveData
  -> FrameworkProvider
  -> module registration
  -> platform provider
  -> workspace open/dispose
  -> workspace scope
  -> async doc storage
  -> worker storage client
  -> workbench root
  -> per-view routing
```

---

## 0. 当前代码快照

已存在：

```text
packages/frontend/app/web
  src/index.tsx
  src/app.tsx
  src/setup.ts

packages/frontend/core
  src/components/app-shell.tsx
  src/framework/framework.ts
  src/framework/react.tsx
  src/modules/index.ts
  src/modules/doc/doc-service.ts
  src/modules/doc/doc-types.ts
  src/modules/site/site-service.ts
  src/modules/storage/doc-storage-service.ts
  src/modules/storage/local-doc-storage-driver.ts
  src/modules/workbench/workbench-service.ts
  src/modules/workspace/workspace-scope.ts
  src/modules/workspace/workspace-service.ts
  src/modules/workspace/workspaces-service.ts
  src/pages/workspace-route.tsx
  src/pages/workspace/all-docs-page.tsx
  src/pages/workspace/doc-page.tsx
  src/router.tsx
  src/shared/live-data.ts
  src/shared/use-live-data.ts
```

当前已经完成的学习点：

| 阶段 | 当前状态 | AFFiNE 对应概念 |
| --- | --- | --- |
| Browser bootstrap | `app/web/src/index.tsx`、`setup.ts` 已有 | `apps/web/src/index.tsx`、`setup.ts` |
| Root framework | `app.tsx` 创建 `Framework` 和 provider | `apps/web/src/app.tsx` |
| Service cache | `FrameworkProvider.get()` 懒创建并缓存 | `@toeverything/infra` provider |
| React service access | `FrameworkRoot`、`useService` 已有 | `FrameworkRoot`、`useService` |
| Workspace list | `WorkspacesService` 已拆出 | `modules/workspace/services/workspaces.ts` |
| Workspace scope | `WorkspaceScopeRoot` 创建 child provider | `modules/workspace/scopes/workspace.ts` |
| Workspace service | scope 内读取当前 workspace meta | `modules/workspace/services/workspace.ts` |
| Doc model | `Doc` 类型、`DocService` 已有 | `modules/doc` |
| Storage driver | 同步 `DocStorageDriver` + localStorage | web app 的 nbstore provider 的玩具版 |
| Workspace route | `/workspace/:workspaceId/all`、`/:docId` 已接 | `desktop/pages/workspace/index.tsx` |
| Workbench state | `WorkbenchService` + `WorkbenchRoot` 已有 | `modules/workbench/services/workbench.ts` |
| Browser adapter | 未实现，第 8 步 | `modules/workbench/view/browser-adapter.ts` |
| View scope | 未实现，第 9 步 | `modules/workbench/view/view-root.tsx` |

当前缺口：

1. `DocStorageDriver` 还是同步接口，不能自然接 worker。（若第 3–6 步已完成则可划掉）
2. `DocService` 构造函数里同步读取 storage，缺少 loading/error 状态。（若第 4 步已完成则可划掉）
3. ~~`WorkbenchService` 只是状态容器，还没有 `WorkbenchRoot`、view router~~ — 第 7 步已完成 `WorkbenchRoot` + 条件渲染路由，但 **还没有 browser router adapter**（第 8 步）。
4. ~~workspace 的打开动作散在 `WorkspaceScopeRoot` 里~~ — 已收到 `WorkspacesService.open` + `useWorkspaceScope`（第 2 步）。
5. web app 入口只注册 common modules，还没有“平台能力 impl/provider”这一层。（若第 3 步已完成则可划掉）
6. ~~路由里还没有 settings 页面~~ — 若第 1 步已完成则有；browser URL 与 active view 仍不同步（第 8 步）。
7. `View` 仍是 plain object，没有 per-view scope / `ViewRoot`（第 9 步）。

---

## 1. 先补齐第 12 步的小缺口

目标：让当前“已完成到第 12 步”的状态真的闭合。

### 1.1 增加 workspace settings 页面

新增：

```text
packages/frontend/core/src/pages/workspace/settings-page.tsx
```

内容保持最小：

```tsx
import { useService } from "~/src/framework/react";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";

export function WorkspaceSettingsPage() {
  const workspace = useService(WorkspaceService);

  return <h1>{workspace.name} settings</h1>;
}
```

更新 `packages/frontend/core/src/router.tsx`：

```tsx
import { WorkspaceSettingsPage } from "./pages/workspace/settings-page";

// children:
{ path: "settings", element: <WorkspaceSettingsPage /> },
```

验收：

```text
/workspace/local/settings
/workspace/demo/settings
```

都能显示对应 workspace 名称。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/workbench-router.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/settings
```

---

## 2. 把 workspace 打开动作收回 WorkspacesService

目标：更接近 AFFiNE 的 `workspacesService.open(...) -> ref.workspace.scope -> ref.dispose()`。

当前 `WorkspaceScopeRoot` 自己做了这些事：

```text
找到 meta
  -> root.createChild(...)
  -> 注册 WorkspaceScope / WorkspaceService / DocService / WorkbenchService
  -> unmount 时 provider.dispose()
```

这可以跑，但职责不对。页面不应该知道“打开 workspace 要注册哪些 service”。页面应该只表达：

```text
我要打开这个 workspace
卸载时我要关闭它
```

### 2.1 新增 WorkspaceRef

先不要做复杂 `Workspace` entity。只做一个可 dispose 的 ref。

新增：

```text
packages/frontend/core/src/modules/workspace/workspace-ref.ts
```

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceRef {
  constructor(
    public readonly meta: WorkspaceMeta,
    public readonly provider: FrameworkProvider,
  ) {}

  dispose() {
    this.provider.dispose();
  }
}
```

### 2.2 给 WorkspacesService 增加 open

`WorkspacesService` 现在只管 list。下一步让它也负责打开 workspace，并且顺手修正当前 `get()` 里少了 `return` 的问题。

重写：

```text
packages/frontend/core/src/modules/workspace/workspaces-service.ts
```

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { DocService } from "~/src/modules/doc/doc-service";
import { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import { WorkbenchService } from "~/src/modules/workbench/workbench-service";
import { LiveData } from "~/src/shared/live-data";
import { WorkspaceRef } from "./workspace-ref";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export type WorkspaceMeta = {
  id: string;
  name: string;
};

export class WorkspacesService {
  workspaces$ = new LiveData<WorkspaceMeta[]>([
    { id: "local", name: "Local Workspace" },
    { id: "demo", name: "Demo Workspace" },
  ]);

  get(id: string) {
    return this.workspaces$.value.find((workspace) => workspace.id === id);
  }

  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      framework
        .service(WorkspaceScope, () => new WorkspaceScope(meta))
        .service(WorkspaceService, (provider) => {
          return new WorkspaceService(provider.get(WorkspaceScope));
        })
        .service(DocService, (provider) => {
          return new DocService(
            provider.get(WorkspaceService),
            provider.get(DocStorageService),
          );
        })
        .service(WorkbenchService, () => new WorkbenchService());
    });

    return new WorkspaceRef(meta, provider);
  }
}
```

这不是 AFFiNE 的最终形态。真实 AFFiNE 会继续拆到 repository/factory/entity 层；学习版先把 child provider 的创建从 React 组件挪到 service，已经能学到生命周期边界。

### 2.3 WorkspaceRoute 只保留 open/dispose

现在 `WorkspaceScopeRoot` 不再知道 workspace scope 里注册了哪些 service。它只负责：

```text
根据 URL 找 meta
  -> open workspace
  -> FrameworkRoot 使用 ref.provider
  -> unmount dispose ref
```

重写：

```text
packages/frontend/core/src/pages/workspace-route.tsx
```

```tsx
import { type PropsWithChildren, useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import {
  FrameworkRoot,
  useFrameworkProvider,
  useService,
} from "~/src/framework/react";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";

function WorkspaceScopeRoot({
  workspaceId,
  children,
}: PropsWithChildren<{ workspaceId: string }>) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const workspaceRef = useMemo(() => {
    if (!meta) {
      return null;
    }

    return workspacesService.open(meta, root);
  }, [meta, root, workspacesService]);

  useEffect(() => {
    return () => {
      workspaceRef?.dispose();
    };
  }, [workspaceRef]);

  if (!meta || !workspaceRef) {
    return <div>Workspace not found</div>;
  }

  return (
    <FrameworkRoot framework={workspaceRef.provider}>
      {children}
    </FrameworkRoot>
  );
}

export function WorkspaceRoute() {
  const { workspaceId } = useParams();

  if (!workspaceId) {
    return <div>Workspace id is missing</div>;
  }

  return (
    <WorkspaceScopeRoot workspaceId={workspaceId}>
      <Outlet />
    </WorkspaceScopeRoot>
  );
}
```

注意这里有一个 React 生命周期细节：`workspaceRef` 是 `useMemo` 创建的，`useEffect` cleanup 负责 dispose。`meta` 或 `root` 变化时会创建新 ref，旧 ref 会被 cleanup 释放。

### 2.4 这一节完成后的文件职责

```text
workspaces-service.ts
  全局 workspace 列表
  根据 meta 打开 workspace runtime
  创建 workspace child provider

workspace-ref.ts
  持有本次打开的 provider
  负责 dispose

workspace-route.tsx
  从 URL 取 workspaceId
  查 meta
  调 open
  把 child provider 放进 FrameworkRoot
```

验收：

1. `/workspace/local/all` 能打开。
2. `/workspace/demo/all` 能打开。
3. 从 local 切到 demo 时不会串 docs。
4. 在 `WorkspaceService` 或 `WorkbenchService` 临时加 `dispose()` 日志，离开 workspace 时能看到释放。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/index.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/services/workspaces.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/services/repo.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/entities/workspace.ts
```

理解重点：

```text
React route component
  -> 负责生命周期

WorkspacesService.open
  -> 负责创建 workspace runtime

WorkspaceRef.dispose
  -> 负责释放 runtime
```

---

## 3. 引入 platform provider，不要把浏览器能力写死进 core

目标：把 `localStorage`、`Worker`、`window.open` 这类浏览器能力从 core 的业务服务里隔离出来。

AFFiNE 的 `apps/web/src/app.tsx` 做了很多平台装配：

```text
configureCommonModules(framework)
configureBrowserWorkbenchModule(framework)
configureLocalStorageStateStorageImpls(framework)
configureBrowserWorkspaceFlavours(framework)
framework.impl(NbstoreProvider, ...)
framework.impl(PopupWindowProvider, ...)
```

你的学习版先只做一个 provider：

```text
DocStorageProvider
```

### 3.1 新增 provider token

新增：

```text
packages/frontend/core/src/modules/storage/doc-storage-provider.ts
```

```ts
import type { DocStorageDriver } from "./doc-storage-service";

export class DocStorageProvider {
  constructor(public driver: DocStorageDriver) {}
}
```

然后 `DocStorageService` 不直接持有 driver，而是依赖 provider：

```ts
export class DocStorageService {
  constructor(private provider: DocStorageProvider) {}

  load(workspaceId: string) {
    return this.provider.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]) {
    this.provider.driver.save(workspaceId, docs);
  }
}
```

### 3.2 明确 LocalDocStorageDriver 放在哪里

确定方案：`LocalDocStorageDriver` 放在 core 的 storage module 里，不放到 `app/web`。

```text
packages/frontend/core/src/modules/storage/local-doc-storage-driver.ts
```

原因很简单：它是 storage module 的一个浏览器实现，和 AFFiNE 的组织方式一致。AFFiNE 也是把 localStorage 实现放在 core storage module 里，再由 web app 入口调用配置函数启用它。

AFFiNE 对应源码：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/storage/impls/storage.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/storage/index.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
```

具体对应关系：

```text
AFFiNE:
  impls/storage.ts
    -> LocalStorageGlobalCache
    -> LocalStorageGlobalState

  modules/storage/index.ts
    -> configureLocalStorageStateStorageImpls(framework)

  apps/web/src/app.tsx
    -> configureLocalStorageStateStorageImpls(framework)

你的学习版:
  modules/storage/local-doc-storage-driver.ts
    -> LocalDocStorageDriver

  modules/storage/index.ts
    -> configureBrowserDocStorageModules(framework)

  app/web/src/app.tsx
    -> configureBrowserDocStorageModules(framework)
```

### 3.3 确定的文档代码

新增 provider token：

```text
packages/frontend/core/src/modules/storage/doc-storage-provider.ts
```

```ts
import type { DocStorageDriver } from "./doc-storage-service";

export class DocStorageProvider {
  constructor(public readonly driver: DocStorageDriver) {}
}
```

重写 storage service：

```text
packages/frontend/core/src/modules/storage/doc-storage-service.ts
```

```ts
import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageProvider } from "./doc-storage-provider";

export interface DocStorageDriver {
  load(workspaceId: string): Doc[];
  save(workspaceId: string, docs: Doc[]): void;
}

export class DocStorageService {
  constructor(private readonly provider: DocStorageProvider) {}

  load(workspaceId: string) {
    return this.provider.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]) {
    this.provider.driver.save(workspaceId, docs);
  }
}
```

保留并确认 localStorage driver 位置：

```text
packages/frontend/core/src/modules/storage/local-doc-storage-driver.ts
```

```ts
import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageDriver } from "./doc-storage-service";

export class LocalDocStorageDriver implements DocStorageDriver {
  load(workspaceId: string) {
    const raw = localStorage.getItem(`workspace:${workspaceId}:docs`);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  }

  save(workspaceId: string, docs: Doc[]) {
    localStorage.setItem(`workspace:${workspaceId}:docs`, JSON.stringify(docs));
  }
}
```

新增 storage module 统一出口和浏览器实现配置函数：

```text
packages/frontend/core/src/modules/storage/index.ts
```

```ts
import type { Framework } from "~/src/framework/framework";
import { DocStorageProvider } from "./doc-storage-provider";
import { DocStorageService } from "./doc-storage-service";
import { LocalDocStorageDriver } from "./local-doc-storage-driver";

export { DocStorageProvider } from "./doc-storage-provider";
export { DocStorageService } from "./doc-storage-service";
export { LocalDocStorageDriver } from "./local-doc-storage-driver";

export function configureDocStorageModule(framework: Framework) {
  framework.service(DocStorageService, (provider) => {
    return new DocStorageService(provider.get(DocStorageProvider));
  });
}

export function configureBrowserDocStorageModules(framework: Framework) {
  framework.service(DocStorageProvider, () => {
    return new DocStorageProvider(new LocalDocStorageDriver());
  });
}
```

更新 common modules。这里不再 import `DocStorageProvider` 或 `LocalDocStorageDriver`：

```text
packages/frontend/core/src/modules/index.ts
```

```ts
import type { Framework } from "~/src/framework/framework";
import { SiteService } from "./site/site-service";
import { configureDocStorageModule } from "./storage";
import { WorkspacesService } from "./workspace/workspaces-service";

export function configureCommonModules(framework: Framework) {
  framework
    .service(SiteService, () => new SiteService())
    .service(WorkspacesService, () => new WorkspacesService());

  configureDocStorageModule(framework);
}
```

更新 core export：

```text
packages/frontend/core/src/index.ts
```

```ts
export { AppShell } from "./components/app-shell";
export { Framework } from "./framework/framework";
export {
  FrameworkRoot,
  useFrameworkProvider,
  useService,
} from "./framework/react";
export { configureCommonModules } from "./modules";
export { configureBrowserDocStorageModules } from "./modules/storage";
export { router } from "./router";
```

最后在 web app 入口启用浏览器 storage 实现：

```text
packages/frontend/app/web/src/app.tsx
```

```tsx
import "./setup";
import {
  AppShell,
  configureBrowserDocStorageModules,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
configureCommonModules(framework);
configureBrowserDocStorageModules(framework);

const frameworkProvider = framework.provider();

export function App() {
  return (
    <FrameworkRoot framework={frameworkProvider}>
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    </FrameworkRoot>
  );
}
```

验收：

1. `DocStorageService` 不再直接 `new LocalDocStorageDriver()`。
2. `configureCommonModules` 不再知道 `localStorage`。
3. `LocalDocStorageDriver` 的确定位置是 `packages/frontend/core/src/modules/storage/local-doc-storage-driver.ts`。
4. web app 通过 `configureBrowserDocStorageModules(framework)` 启用 localStorage driver。
5. 之后换成 worker driver 时，优先改 `configureBrowserDocStorageModules`，页面和 `DocStorageService` 不动。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/storage/index.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/storage/impls/storage.ts
```

理解重点：

```text
core module:
  定义能力和依赖

web app:
  提供浏览器实现
```

---

## 4. 把 DocStorage 改成异步接口

目标：为 worker storage 铺路。

第 13 部分不能直接从同步 localStorage 跳到 worker。worker RPC 天然是异步的，所以先把接口改成异步。

### 4.1 修改 storage driver

这一步要同时改 `DocStorageDriver`、`DocStorageService` 和
`LocalDocStorageDriver`。重点不是让 `localStorage` 真的变成非阻塞，而是先把
storage 边界改成 Promise 形状，这样第 5 部分才能无缝换成 worker driver。

更新 storage service：

```text
packages/frontend/core/src/modules/storage/doc-storage-service.ts
```

```ts
import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageProvider } from "./doc-storage-provider";

export interface DocStorageDriver {
  load(workspaceId: string): Promise<Doc[]>;
  save(workspaceId: string, docs: Doc[]): Promise<void>;
}

export class DocStorageService {
  constructor(private readonly provider: DocStorageProvider) {}

  load(workspaceId: string): Promise<Doc[]> {
    return this.provider.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]): Promise<void> {
      return this.provider.driver.save(workspaceId, docs);
  }
}
```

注意 `save()` 必须 `return` driver 的 Promise。否则 4.2 里的
`await this.storage.save(...)` 会立刻结束，保存失败也不会进入调用方的
`catch`。

`LocalDocStorageDriver` 保持使用 `localStorage`，但方法返回 Promise：

这里的 `async` 是接口适配，不是性能优化。`async load()` 里直接
`return []` 会被 JavaScript 包装成 `Promise.resolve([])`；`async save()`
没有显式 `return`，也会返回 `Promise<void>`。`localStorage` 的读写仍然是同步
执行的，只是同步异常会变成 rejected Promise，方便 4.2 的 `error$` 统一处理。

```text
packages/frontend/core/src/modules/storage/local-doc-storage-driver.ts
```

```ts
import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageDriver } from "./doc-storage-service";

export class LocalDocStorageDriver implements DocStorageDriver {
  async load(workspaceId: string): Promise<Doc[]> {
    const raw = localStorage.getItem(`workspace:${workspaceId}:docs`);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  }

  async save(workspaceId: string, docs: Doc[]): Promise<void> {
    localStorage.setItem(`workspace:${workspaceId}:docs`, JSON.stringify(docs));
  }
}
```

### 4.2 DocService 增加 ready/error 状态

这一节的核心落点只有一个文件：

```text
packages/frontend/core/src/modules/doc/doc-service.ts
```

它接在 4.1 后面。4.1 已经把 `DocStorageService.load/save` 改成
`Promise` 接口；4.2 要做的是让 `DocService` 消化这个异步边界：

```text
WorkspacesService.open(...)
  -> workspace child provider 创建 DocService
  -> DocService 构造函数只创建 LiveData 状态
  -> constructor 里调用 void this.load()
  -> load() await storage.load(workspaceId)
  -> 成功：写入 docs$，ready$ = true，error$ = null
  -> 失败：写入 error$，页面显示错误
```

相关上下文：

```text
packages/frontend/core/src/modules/workspace/workspaces-service.ts
  open(...) 里注册 DocService，所以每个 workspace 都有自己的 DocService 实例。

packages/frontend/core/src/modules/storage/doc-storage-service.ts
  4.1 已把 load/save 改成 Promise，且 save() 必须 return driver.save(...)。

packages/frontend/core/src/pages/workspace/all-docs-page.tsx
packages/frontend/core/src/pages/workspace/doc-page.tsx
  4.3 会读取 ready$/error$/docs$。
```

不要在构造函数里 `await`。构造函数不能是 `async`，也不应该阻塞 provider 创建。
它只负责把状态初始化好，然后启动一次异步加载。

完整实现：

```text
packages/frontend/core/src/modules/doc/doc-service.ts
```

```ts
import type { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import type { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { LiveData } from "~/src/shared/live-data";
import type { Doc } from "./doc-types";

function createWelcomeDoc(): Doc {
  return {
    id: "welcome",
    title: "Welcome",
    content: "Hello AFFiNE style",
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class DocService {
  docs$ = new LiveData<Doc[]>([]);
  ready$ = new LiveData(false);
  error$ = new LiveData<Error | null>(null);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly storage: DocStorageService,
  ) {
    void this.load();
  }

  create(title: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title,
      content: "",
    };

    void this.save([...this.docs$.value, doc]);

    return doc;
  }

  rename(id: string, title: string) {
    const nextDocs = this.docs$.value.map((doc) => {
      return doc.id === id ? { ...doc, title } : doc;
    });

    void this.save(nextDocs);
  }

  get(id: string) {
    return this.docs$.value.find((doc) => doc.id === id);
  }

  private async load() {
    this.error$.set(null);

    try {
      const stored = await this.storage.load(this.workspaceService.id);

      this.docs$.set(stored.length > 0 ? stored : [createWelcomeDoc()]);
      this.ready$.set(true);
    } catch (error) {
      this.error$.set(toError(error));
    }
  }

  private async save(docs: Doc[]) {
    this.docs$.set(docs);
    this.error$.set(null);

    try {
      await this.storage.save(this.workspaceService.id, docs);
    } catch (error) {
      this.error$.set(toError(error));
    }
  }
}
```

这里的 `void this.save(...)` 是学习版的取舍：UI 先乐观更新，保存失败时只写入
`error$`，不做回滚、重试和 dirty state。注意 `save()` 内部自己 `catch`，
所以这不是简单忽略错误，也不会产生未处理的 rejected Promise。真正产品要继续补：

```text
保存中状态
保存失败后的重试
本地乐观更新回滚
未保存 dirty state
```

### 4.3 页面处理 loading/error

4.2 之后，页面不能只订阅 `docs$`。因为 `docs$` 初始值是空数组，真正的数据
要等 `load()` 完成后才知道。页面要同时读：

```text
docs$   -> 文档列表
ready$  -> 首次加载是否完成
error$  -> load/save 是否失败
```

先处理 error，再处理 loading，最后渲染正常内容。

完整实现：

```text
packages/frontend/core/src/pages/workspace/all-docs-page.tsx
```

```tsx
import { Link } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function AllDocsPage() {
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  return (
    <section>
      <h1>{workspace.name}</h1>
      <button type="button" onClick={() => docService.create("Untitled")}>
        New Doc
      </button>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <Link to={`/workspace/${workspace.id}/${doc.id}`}>{doc.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```text
packages/frontend/core/src/pages/workspace/doc-page.tsx
```

```tsx
import { useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function DocPage() {
  const { docId } = useParams();
  const docService = useService(DocService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);
  const doc = docs.find((item) => item.id === docId);

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  if (!doc) {
    return <div>Doc not found</div>;
  }

  return (
    <article>
      <input
        value={doc.title}
        onChange={(event) => docService.rename(doc.id, event.target.value)}
      />
      <p>{doc.content || "Empty doc"}</p>
    </article>
  );
}
```

验收：

1. `/workspace/local/all` 首次进入显示后能加载 docs。
2. 新建 doc 后刷新仍存在。
3. local/demo 数据不串。
4. 临时让 driver `throw new Error("storage failed")`，页面显示错误。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/index.tsx
```

真实 AFFiNE 会等 root doc ready：

```text
workspace.engine.doc.docState$(workspace.id).pipe(map(v => v.ready))
```

你的学习版先只等：

```text
docService.ready$
```

---

## 5. 实现最小 worker RPC

目标：理解 AFFiNE 的 `OpClient` / `OpConsumer`，但先写 80 行学习版。

不要直接复制：

```text
@toeverything/infra/op/client.ts
@toeverything/infra/op/consumer.ts
@affine/nbstore/worker/client
@affine/nbstore/worker/consumer
```

先实现两个操作：

```text
loadDocs(workspaceId)
saveDocs(workspaceId, docs)
```

### 5.1 新增 shared RPC 类型

新增：

```text
packages/frontend/core/src/modules/storage/worker-doc-storage-rpc.ts
```

```ts
import type { Doc } from "../doc/doc-types";

export type WorkerDocStorageOps = {
  loadDocs: {
    input: { workspaceId: string };
    output: Doc[];
  };
  saveDocs: {
    input: { workspaceId: string; docs: Doc[] };
    output: null;
  };
};

export type WorkerDocStorageMethod = keyof WorkerDocStorageOps;

export type WorkerRequestShape<M extends WorkerDocStorageMethod> = {
  id: string;
  method: M;
  payload: WorkerDocStorageOps[M]["input"];
};

export type WorkerRequest<
  M extends WorkerDocStorageMethod = WorkerDocStorageMethod,
> = {
  [K in M]: WorkerRequestShape<K>;
}[M];

export type WorkerResponse<
  M extends WorkerDocStorageMethod = WorkerDocStorageMethod,
> = M extends WorkerDocStorageMethod
  ?
      | {
          id: string;
          result: WorkerDocStorageOps[M]["output"];
        }
      | {
          id: string;
          error: string;
        }
  : never;
```

### 5.2 新增 worker client driver

新增：

```text
packages/frontend/core/src/modules/storage/worker-doc-storage-driver.ts
```

```ts
import type { Doc } from "../doc/doc-types";
import type { DocStorageDriver } from "./doc-storage-service";
import type {
  WorkerDocStorageMethod,
  WorkerDocStorageOps,
  WorkerRequestShape,
  WorkerResponse,
} from "./worker-doc-storage-rpc";

export class WorkerDocStorageDriver implements DocStorageDriver {
  constructor(private worker: Worker) {}

  load(workspaceId: string) {
    return this.request("loadDocs", { workspaceId });
  }

  async save(workspaceId: string, docs: Doc[]) {
    await this.request("saveDocs", { workspaceId, docs });
  }

  private request<M extends WorkerDocStorageMethod>(
    method: M,
    payload: WorkerDocStorageOps[M]["input"],
  ) {
    return new Promise<WorkerDocStorageOps[M]["output"]>((resolve, reject) => {
      const id = crypto.randomUUID();

      const onMessage = (event: MessageEvent<WorkerResponse<M>>) => {
        if (event.data.id !== id) {
          return;
        }

        this.worker.removeEventListener("message", onMessage);

        if ("error" in event.data) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };

      this.worker.addEventListener("message", onMessage);
      this.worker.postMessage(
        { id, method, payload } satisfies WorkerRequestShape<M>,
      );
    });
  }
}
```

### 5.3 在 web app 新增 worker 文件

新增：

```text
packages/frontend/app/web/src/doc-storage.worker.ts
```

学习版可以先用 worker 内存 Map，不要一开始接 IndexedDB：

```ts
import type { Doc, WorkerRequest, WorkerResponse } from "@malphite/core";

const docsByWorkspace = new Map<string, Doc[]>();

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, method, payload } = event.data;

  try {
    if (method === "loadDocs") {
      const { workspaceId } = payload;
      self.postMessage({
        id,
        result: docsByWorkspace.get(workspaceId) ?? [],
      } satisfies WorkerResponse<"loadDocs">);
      return;
    }

    if (method === "saveDocs") {
      const { workspaceId, docs } = payload;
      docsByWorkspace.set(workspaceId, docs);
      self.postMessage({ id, result: null } satisfies WorkerResponse<"saveDocs">);
      return;
    }

    self.postMessage({ id, error: `Unknown method: ${method}` });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

如果 core 当前没有导出这些类型，就更新：

```text
packages/frontend/core/src/index.ts
```

导出 `Doc`、RPC 类型和 `WorkerDocStorageDriver`。

如果 TypeScript 仍然不能根据 `method` 缩窄 `payload`，不要改成 `any`。先确认 `WorkerRequest` 是上面这种 distributive union；必要时在每个分支里用局部类型断言，例如 `const payload = event.data.payload as WorkerDocStorageOps["loadDocs"]["input"]`。

### 5.4 在 web app 使用 worker driver

对照当前真实代码，`packages/frontend/app/web/src/app.tsx` 现在不是直接注册
`DocStorageProvider`，而是调用 core 暴露的浏览器 storage 注册函数：

```ts
configureCommonModules(framework);
configureBrowserDocStorageModules(framework);
```

所以这里不要在 `app.tsx` 里绕过既有边界手写
`framework.service(DocStorageProvider, ...)`。更合理的改法是让
`configureBrowserDocStorageModules` 接收一个可替换 driver，默认仍然使用
`LocalDocStorageDriver`。

先更新：

```text
packages/frontend/core/src/modules/storage/index.ts
```

```ts
import type { Framework } from "~/src/framework/framework";
import type { DocStorageDriver } from "./doc-storage-service";
import { DocStorageProvider } from "./doc-storage-provider";
import { DocStorageService } from "./doc-storage-service";
import { LocalDocStorageDriver } from "./local-doc-storage-driver";

export { DocStorageProvider } from "./doc-storage-provider";
export { DocStorageService } from "./doc-storage-service";
export { LocalDocStorageDriver } from "./local-doc-storage-driver";
export { WorkerDocStorageDriver } from "./worker-doc-storage-driver";

export function configureDocStorageModule(framework: Framework) {
  framework.service(DocStorageService, (provider) => {
    return new DocStorageService(provider.get(DocStorageProvider));
  });
}

export function configureBrowserDocStorageModules(
  framework: Framework,
  driver: DocStorageDriver = new LocalDocStorageDriver(),
) {
  framework.service(DocStorageProvider, () => {
    return new DocStorageProvider(driver);
  });
}
```

再更新 public export。当前 `packages/frontend/core/src/index.ts` 已经导出了
`Doc`、`WorkerRequest`、`WorkerResponse`，这里只需要把
`WorkerDocStorageDriver` 加进 storage export：

```text
packages/frontend/core/src/index.ts
```

```ts
export {
  configureBrowserDocStorageModules,
  WorkerDocStorageDriver,
} from "./modules/storage";
```

最后才改 web app：

```text
packages/frontend/app/web/src/app.tsx
```

```ts
import {
  AppShell,
  configureBrowserDocStorageModules,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
  WorkerDocStorageDriver,
} from "@malphite/core";

const worker = new Worker(new URL("./doc-storage.worker.ts", import.meta.url), {
  type: "module",
});

const framework = new Framework();
configureCommonModules(framework);
configureBrowserDocStorageModules(
  framework,
  new WorkerDocStorageDriver(worker),
);
```

`packages/frontend/core/src/modules/storage/worker-doc-storage-driver.ts` 当前已经有了
`WorkerDocStorageDriver`。如果里面的私有方法还叫 `requset`，顺手改成
`request`，调用点一起改；这是拼写修正，不改变行为。

验收：

1. dev server 能启动。
2. `/workspace/local/all` 能创建 doc。
3. 同一页面生命周期内切换 local/demo 不串数据。
4. 刷新后数据丢失是正常的，因为 worker Map 是内存版。
5. 能解释为什么：worker 和 main thread 是两个 JS runtime，只能靠 message 通信。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/nbstore.worker.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/op/client.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/op/consumer.ts
```

理解重点：

```text
main thread:
  WorkerDocStorageDriver.request(...)
  -> postMessage({ id, method, payload })
  -> await response

worker:
  receive request
  -> run handler
  -> postMessage({ id, result | error })
```

---

## 6. 给 worker storage 加持久化

目标：把第 5 步的 worker Map 换成浏览器持久化，但还不引入完整 IndexedDB 抽象。

可以先在 worker 里继续用 `localStorage` 吗？不行。Dedicated Worker 里没有 `localStorage`。这正是为什么 AFFiNE 走 IndexedDB/nbstore。

学习版有两个选择：

1. 直接写一个很小的 IndexedDB helper。
2. 先用 OPFS 或 Cache API。这里不建议，离 AFFiNE 主线更远。

建议实现一个最小 IndexedDB helper：

```text
database: malphite-doc-storage
store: docs
key: workspaceId
value: Doc[]
```

新增：

```text
packages/frontend/app/web/src/doc-storage-idb.ts
```

这一节只替换 worker 内部的持久化后端，不再改
`WorkerDocStorageDriver`、`DocStorageService`、
`configureBrowserDocStorageModules`。第 5 步已经把主线程到 worker 的边界接好了，第 6 步只把 worker 内部的内存 `Map` 换成 `IndexedDB`。

### 6.1 新增 IndexedDB helper

`doc-storage-idb.ts` 只暴露 `loadDocs` / `saveDocs`：

```ts
import type { Doc } from "@malphite/core";

const DB_NAME = "malphite-doc-storage";
const STORE_NAME = "docs";
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
    };
  });

  return databasePromise;
}

export async function loadDocs(workspaceId: string): Promise<Doc[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request =
      tx.objectStore(STORE_NAME).get(workspaceId) as IDBRequest<Doc[] | undefined>;

    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to load docs"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB read aborted"));
  });
}

export async function saveDocs(
  workspaceId: string,
  docs: Doc[],
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(docs, workspaceId);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save docs"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}
```

这里先不要抽象通用 `idb` layer。当前只有 worker 这一处浏览器持久化消费者，先把边界做实；等未来真的出现第二个浏览器存储消费者，再考虑是否上移。

### 6.2 worker 改成异步持久化

更新：

```text
packages/frontend/app/web/src/doc-storage.worker.ts
```

这里不要提前解构 `payload`，直接用 `request.method` 做类型收窄：

```ts
import type { WorkerRequest, WorkerResponse } from "@malphite/core";
import { loadDocs, saveDocs } from "./doc-storage-idb";

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest) {
  try {
    if (request.method === "loadDocs") {
      const { workspaceId } = request.payload;
      self.postMessage({
        id: request.id,
        result: await loadDocs(workspaceId),
      } satisfies WorkerResponse<"loadDocs">);
      return;
    }

    if (request.method === "saveDocs") {
      const { workspaceId, docs } = request.payload;
      await saveDocs(workspaceId, docs);
      self.postMessage({
        id: request.id,
        result: null,
      } satisfies WorkerResponse<"saveDocs">);
      return;
    }

    self.postMessage({
      id: request.id,
      error: `Unknown method: ${request.method}`,
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

这样改完以后，主线程的 `WorkerDocStorageDriver`、storage service、provider、以及
`configureBrowserDocStorageModules` 都不需要再动。主线程继续只负责
RPC 请求，worker 内部自己决定是用内存、IndexedDB，还是未来换成更复杂的存储实现。

### 6.3 验收

1. 刷新页面后，新建 doc 仍存在。
2. 关闭 tab 后重新打开，新建 doc 仍存在。
3. `local` / `demo` workspace 数据不串。
4. DevTools `Application -> IndexedDB` 能看到 `malphite-doc-storage / docs`。
5. 人工制造异常时，worker 仍然通过 `WorkerResponse.error` 把错误回传到主线程。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/nbstore.worker.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/impls/idb
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/worker/consumer.ts
```

理解重点：

```text
worker 不是为了炫技
worker 是为了把重 IO / 数据库 / 同步协议移出 React 主线程
```

---

## 7. 把 Workbench 从 service 接到 UI

目标：开始理解 AFFiNE 为什么不只是 React Router 嵌套路由。

当前：

```text
router:
  /workspace/:workspaceId/all -> AllDocsPage
  /workspace/:workspaceId/:docId -> DocPage

WorkbenchService:
  views$ = [{ id: "main", path: "/all" }]
  activeViewId$ = "main"
```

第 7 步只做一件事：让 workspace 内部先由 `WorkbenchService` 决定显示哪个
view。浏览器 URL 和 active View 的同步留到第 8 步，所以这里不要急着做
browser adapter。

这一节完成后，workspace 下面的页面关系会变成：

```text
browser router:
  /workspace/:workspaceId/*
    -> WorkspaceRoute
    -> WorkspaceScopeRoot
    -> WorkbenchRoot

WorkbenchRoot:
  active view path "/all"
    -> AllDocsPage

  active view path "/settings"
    -> WorkspaceSettingsPage

  active view path "/welcome"
    -> DocPageContent docId="welcome"
```

也就是说，React Router 在这一节只负责两件事：

```text
1. 根据 URL 找到 workspaceId
2. 把 workspace scope 建起来
```

真正的 workspace 内部页面切换，开始交给 `WorkbenchService`。

### 7.1 先补强 WorkbenchService

当前仓库已经有：

```text
packages/frontend/core/src/modules/workbench/workbench-service.ts
```

但是它还只是一个最小状态容器。第 7 步需要让它能支撑基本 tab UI：

```text
open(path)
  -> 已经打开过同一个 path：只激活旧 view
  -> 没打开过：创建新 view 并激活

activate(id)
  -> 点击 tab 时切换 active view

close(id)
  -> 关闭 view
  -> 如果关闭的是 active view，激活旁边的 view
  -> 最后一个 view 不允许关闭
```

重写：

```text
packages/frontend/core/src/modules/workbench/workbench-service.ts
```

```ts
import { LiveData } from "~/src/shared/live-data";

export type View = {
  id: string;
  path: string;
  title: string;
};

const MAIN_VIEW: View = {
  id: "main",
  path: "/all",
  title: "All Docs",
};

function normalizePath(path: string) {
  if (path === "" || path === "/") {
    return "/all";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function getViewTitle(path: string) {
  if (path === "/all") {
    return "All Docs";
  }

  if (path === "/settings") {
    return "Settings";
  }

  return path.slice(1);
}

function createView(path: string): View {
  const normalizedPath = normalizePath(path);

  return {
    id: crypto.randomUUID(),
    path: normalizedPath,
    title: getViewTitle(normalizedPath),
  };
}

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  open(path: string) {
    const normalizedPath = normalizePath(path);
    const existing = this.views$.value.find((view) => {
      return view.path === normalizedPath;
    });

    if (existing) {
      this.activeViewId$.set(existing.id);
      return existing;
    }

    const view = createView(normalizedPath);

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);

    return view;
  }

  activate(id: string) {
    const exists = this.views$.value.some((view) => {
      return view.id === id;
    });

    if (exists) {
      this.activeViewId$.set(id);
    }
  }

  close(id: string) {
    const views = this.views$.value;

    if (views.length <= 1) {
      return;
    }

    const closedIndex = views.findIndex((view) => {
      return view.id === id;
    });

    if (closedIndex === -1) {
      return;
    }

    const nextViews = views.filter((view) => {
      return view.id !== id;
    });

    this.views$.set(nextViews);

    if (this.activeViewId$.value === id) {
      const nextActiveView = nextViews[Math.min(closedIndex, nextViews.length - 1)];
      this.activeViewId$.set(nextActiveView?.id ?? "");
    }
  }
}
```

这仍然不是 AFFiNE 的最终结构。真实 AFFiNE 会把 view 做成 entity，并给每个
view 独立的 location、history、scope。学习版先保持 plain object，等第 9 步再
升级。

### 7.2 新增 WorkbenchRoot

新增：

```text
packages/frontend/core/src/modules/workbench/workbench-root.tsx
```

完整实现：

```tsx
import { useService } from "~/src/framework/react";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

export function WorkbenchRoot() {
  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0];

  if (!activeView) {
    return null;
  }

  return (
    <section>
      <header>
        <div role="tablist" aria-label="Workbench views">
          {views.map((view) => (
            <span key={view.id}>
              <button
                type="button"
                role="tab"
                aria-selected={view.id === activeView.id}
                onClick={() => workbench.activate(view.id)}
              >
                {view.title}
              </button>
              <button
                type="button"
                aria-label={`Close ${view.title}`}
                disabled={views.length <= 1}
                onClick={() => workbench.close(view.id)}
              >
                Close
              </button>
            </span>
          ))}
        </div>

        <nav aria-label="Workspace tools">
          <button type="button" onClick={() => workbench.open("/all")}>
            All Docs
          </button>
          <button type="button" onClick={() => workbench.open("/settings")}>
            Settings
          </button>
        </nav>
      </header>

      <WorkbenchView path={activeView.path} />
    </section>
  );
}

function WorkbenchView({ path }: { path: string }) {
  if (path === "/all") {
    return <AllDocsPage />;
  }

  if (path === "/settings") {
    return <WorkspaceSettingsPage />;
  }

  return <DocPageContent docId={path.slice(1)} />;
}
```

这里刻意先用条件渲染，不要马上接 memory router。现在要学的是：

```text
WorkbenchService 的 active view
  -> WorkbenchRoot 订阅 active view
  -> WorkbenchView 根据 view.path 渲染页面
```

memory router 和 per-view scope 放到第 9 步。

### 7.3 把 DocPage 拆成 prop 版内容组件

当前 `DocPage` 从 `useParams()` 读 `docId`：

```text
browser route
  -> useParams()
  -> DocPage
```

接入 Workbench 后，doc 页面应该可以从 workbench view path 读取 doc id：

```text
workbench active view path "/welcome"
  -> DocPageContent docId="welcome"
```

所以先把页面拆成两层：

```text
DocPageContent
  只负责渲染 doc，docId 从 props 来

DocPage
  兼容旧 browser route 的 wrapper，从 useParams() 取 docId
```

重写：

```text
packages/frontend/core/src/pages/workspace/doc-page.tsx
```

```tsx
import { useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { useLiveData } from "~/src/shared/use-live-data";

type DocPageContentProps = {
  docId: string | undefined;
};

export function DocPageContent({ docId }: DocPageContentProps) {
  const docService = useService(DocService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);
  const doc = docs.find((item) => item.id === docId);

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  if (!docId) {
    return <div>Doc id is missing</div>;
  }

  if (!doc) {
    return <div>Doc not found</div>;
  }

  return (
    <article>
      <input
        value={doc.title}
        onChange={(event) => docService.rename(doc.id, event.target.value)}
      />
      <p>{doc.content || "Empty doc"}</p>
    </article>
  );
}

export function DocPage() {
  const { docId } = useParams();

  return <DocPageContent docId={docId} />;
}
```

`DocPage` 这个 wrapper 现在看起来多余，但先保留。它让你能清楚看到两种入口的
差异：

```text
旧入口:
  browser route params -> DocPage -> DocPageContent

新入口:
  workbench view path -> WorkbenchView -> DocPageContent
```

### 7.4 AllDocsPage 不再用 Link 打开 doc

当前 `AllDocsPage` 里点击 doc 是：

```text
Link to /workspace/:workspaceId/:docId
```

接入 Workbench 后，这里应该变成：

```text
workbench.open(`/${doc.id}`)
```

重写：

```text
packages/frontend/core/src/pages/workspace/all-docs-page.tsx
```

```tsx
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { WorkbenchService } from "~/src/modules/workbench/workbench-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function AllDocsPage() {
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
  const workbench = useService(WorkbenchService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);

  function createDoc() {
    const doc = docService.create("Untitled");
    workbench.open(`/${doc.id}`);
  }

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  return (
    <section>
      <h1>{workspace.name}</h1>
      <button type="button" onClick={createDoc}>
        New Doc
      </button>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <button type="button" onClick={() => workbench.open(`/${doc.id}`)}>
              {doc.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

注意这个变化的含义：点击文档不再销毁当前 workspace route，也不会重新创建
workspace scope。它只是在当前 workspace scope 内新增或激活一个 view。

### 7.5 WorkspaceRoute 只负责打开 workspace scope

当前 `WorkspaceRoute` 通过 `<Outlet />` 把 nested browser route 渲染出来。
接入 Workbench 后，它应该只负责：

```text
从 URL 取 workspaceId
  -> WorkspacesService.open(...)
  -> FrameworkRoot 使用 workspaceRef.provider
  -> 渲染 WorkbenchRoot
  -> unmount 时 workspaceRef.dispose()
```

实际实现里，open/dispose 被抽到了 hook，避免 StrictMode 下 `useMemo` 创建
ref 却来不及 dispose 的问题：

新增：

```text
packages/frontend/core/src/modules/workspace/use-workspace-scope.ts
```

```tsx
import { useEffect, useState } from "react";
import { useFrameworkProvider, useService } from "~/src/framework/react";
import type { WorkspaceRef } from "./workspace-ref";
import { type WorkspaceMeta, WorkspacesService } from "./workspaces-service";

export function useWorkspaceScope(meta: WorkspaceMeta | undefined) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const [workspaceRef, setWorkspaceRef] = useState<WorkspaceRef | null>(null);

  useEffect(() => {
    if (!meta) {
      setWorkspaceRef(null);
      return;
    }

    const ref = workspacesService.open(meta, root);
    setWorkspaceRef(ref);

    return () => {
      ref.dispose();
      setWorkspaceRef(null);
    };
  }, [meta, root, workspacesService]);

  return workspaceRef;
}
```

重写：

```text
packages/frontend/core/src/pages/workspace-route.tsx
```

```tsx
import { useParams } from "react-router-dom";
import { FrameworkRoot, useService } from "~/src/framework/react";
import { WorkbenchRoot } from "~/src/modules/workbench/workbench-root";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";
import { useWorkspaceScope } from "../modules/workspace/use-workspace-scope";

function WorkspaceScopeRoot({ workspaceId }: { workspaceId: string }) {
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const workspaceRef = useWorkspaceScope(meta);

  if (!meta) {
    return <div>Workspace not found</div>;
  }

  if (!workspaceRef) {
    return <div>Loading workspace...</div>;
  }

  return (
    <FrameworkRoot framework={workspaceRef.provider}>
      <WorkbenchRoot />
    </FrameworkRoot>
  );
}

export function WorkspaceRoute() {
  const { workspaceId } = useParams();

  if (!workspaceId) {
    return <div>Workspace id is missing</div>;
  }

  return <WorkspaceScopeRoot workspaceId={workspaceId} />;
}
```

`useWorkspaceScope` 和文档早期版本里 inline 的 `useMemo + useEffect` 职责相同，
但 effect 里创建 ref 更符合 React 生命周期，也更容易在 StrictMode 下配对 dispose。

这一步之后，workspace route 不再知道 `/all`、`/settings`、`/:docId` 这些
workspace 内部页面。它只知道如何打开 workspace runtime。

### 7.6 Router 改成 workspace wildcard

最后更新 browser router。workspace route 要能接住
`/workspace/local`、`/workspace/local/all`、`/workspace/local/welcome` 这些
路径，但具体显示哪个 view 还不在这一节处理。

重写 workspace route 部分：

```text
packages/frontend/core/src/router.tsx
```

```tsx
import { createBrowserRouter } from "react-router-dom";
import { useService } from "./framework/react";
import { SiteService } from "./modules/site/site-service";
import { WorkspaceRoute } from "./pages/workspace-route";
import { useLiveData } from "./shared/use-live-data";

function HomePage() {
  const siteService = useService(SiteService);
  const title = useLiveData(siteService.title$);

  return (
    <div>
      <h1>{title}</h1>
      <button
        type="button"
        onClick={() => siteService.rename("Malphite is the best!")}
      >
        Rename
      </button>
    </div>
  );
}

function AboutPage() {
  return <h1>关于</h1>;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/workspace/:workspaceId/*", element: <WorkspaceRoute /> },
]);
```

第 7 步里，`*` 只是为了让浏览器路由别挡住 workspace 内部路径。它还没有把
`/workspace/local/welcome` 同步到 active view。这个同步就是第 8 步的
browser router adapter。

验收：

1. `/workspace/local` 进入 workbench。
2. 默认 view 是 `/all`。
3. `/workspace/local/all` 也能进入 workbench，显示默认 `/all` view。
4. 点击 doc 时不是直接 `<Link>` 跳页面，而是 `workbench.open("/docId")`。
5. 点击已有 doc 会激活已存在的 view，不会重复打开相同 path。
6. 打开多个 doc 后，tab 列表能看到多个 view。
7. 关闭 active view 后，会激活旁边的 view。
8. 关闭 view 不会销毁整个 workspace scope。
9. 直接打开 `/workspace/local/welcome` 还不会自动激活 `/welcome` view，这是第
   8 步要解决的问题。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/workbench-root.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/entities/workbench.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/entities/view.ts
```

理解重点：

```text
Router:
  URL -> 页面

Workbench:
  workspace -> 多个 view
  view -> 自己的 path/history/scope/UI state
```

这一节最重要的变化不是 UI 多了 tab，而是职责边界变了：

```text
before:
  browser router children
    -> AllDocsPage / DocPage / WorkspaceSettingsPage

after:
  browser router
    -> WorkspaceRoute
    -> workspace scope
    -> WorkbenchRoot
    -> active view
    -> AllDocsPage / DocPageContent / WorkspaceSettingsPage
```

---

## 8. 给 Workbench 增加 browser router adapter

目标：让浏览器 URL 和 active view 双向同步。

第 7 步完成后，当前项目已经具备：

```text
browser router: /workspace/:workspaceId/*
  -> WorkspaceRoute
  -> useWorkspaceScope(meta)
  -> WorkbenchRoot
  -> WorkbenchService.open / activate / close
```

但还存在一个明显缺口。你可以亲自验证：

```text
1. 打开 /workspace/local/all
2. 点击某个 doc，workbench 会 open("/docId")，tab 正常出现
3. 浏览器地址栏仍然停在 /workspace/local/all，不会变成 /workspace/local/docId
4. 直接在地址栏输入 /workspace/local/welcome 并回车
   -> 页面还是默认 /all view，不会自动打开 welcome doc
```

这说明 **browser router 和 workbench 现在是两套互不相干的状态机**。第 8 步要做的就是加一层 adapter，把这两套状态绑在一起。

不要一开始复制 AFFiNE 的完整 adapter。学习版分两步：

```text
第一步：browser URL changes -> workbench.open(viewPath)
第二步：active view path changes -> navigate(browserPath)
```

两步都做完，才算双向同步。中间必须用 ref 标记“这次变更是谁触发的”，否则会无限 loop。

### 8.0 先理解两套路由栈

```text
Browser history stack（React Router 管）:
  /workspace/local/all
  /workspace/local/welcome
  /workspace/local/settings

Workbench view list（WorkbenchService 管）:
  views$ = [
    { id: "main", path: "/all" },
    { id: "uuid-1", path: "/welcome" },
  ]
  activeViewId$ = "uuid-1"
```

它们不是同一个东西：

| 概念 | 管什么 | 当前项目对应 |
| --- | --- | --- |
| Browser URL | 用户分享链接、刷新、前进后退 | `react-router-dom` + `/workspace/:workspaceId/*` |
| View path | workspace 内 tab 显示什么 | `WorkbenchService.views$[].path` |

adapter 的核心映射：

```text
basename = /workspace/:workspaceId

browser: /workspace/local/welcome
  -> splat = "welcome"
  -> view path = "/welcome"

browser: /workspace/local
  -> splat = undefined
  -> view path = "/all"

view path = "/all"
  -> browser = /workspace/local/all

view path = "/settings"
  -> browser = /workspace/local/settings
```

学习版约定：`/all` 在浏览器里统一写成 `/workspace/local/all`，不要同时支持 `/workspace/local` 和 `/workspace/local/all` 两种写法，否则 adapter 要处理更多边界。第 7 步验收里两种 URL 都能进 workbench，第 8 步开始以 `/all` 为准。

### 8.1 给 WorkbenchService 增加 activeView 推导

当前 `WorkbenchService` 已经有 `views$` 和 `activeViewId$`。adapter 和 UI 都需要“当前 active view 对象”，不要在每个组件里重复 `find`。

在现有文件末尾、`WorkbenchService` 类里增加一个 getter 即可，不必急着上 `activeView$` LiveData——两个 LiveData 做 combine 会引入额外复杂度，第 9 步升级 `View` 类后再考虑。

修改：

```text
packages/frontend/core/src/modules/workbench/workbench-service.ts
```

在 `WorkbenchService` 中增加：

```ts
get activeView(): View | undefined {
  return (
    this.views$.value.find((view) => view.id === this.activeViewId$.value) ??
    this.views$.value[0]
  );
}
```

可选：给 `open` 增加 `replace` 选项，供以后 view 内跳转使用。学习版可以先不加，browser adapter 自己在 `navigate` 时传 `{ replace: true }` 即可。

### 8.2 新增 browser router adapter hook

新增：

```text
packages/frontend/core/src/modules/workbench/use-bind-workbench-to-browser-router.ts
```

完整实现：

```tsx
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

function splatToViewPath(splat: string | undefined) {
  if (!splat) {
    return "/all";
  }

  return splat.startsWith("/") ? splat : `/${splat}`;
}

function viewPathToSplat(viewPath: string) {
  if (viewPath === "/all") {
    return "all";
  }

  return viewPath.startsWith("/") ? viewPath.slice(1) : viewPath;
}

function buildBrowserPath(workspaceId: string, viewPath: string) {
  const splat = viewPathToSplat(viewPath);
  return `/workspace/${workspaceId}/${splat}`;
}

export function useBindWorkbenchToBrowserRouter() {
  const navigate = useNavigate();
  const { workspaceId, "*": splat } = useParams();
  const workbench = useService(WorkbenchService);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;

  // 标记同步来源，防止 browser <-> workbench 互相触发形成 loop
  const syncSource = useRef<"browser" | "workbench" | null>(null);

  // browser URL -> workbench active view
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    if (syncSource.current === "workbench") {
      syncSource.current = null;
      return;
    }

    syncSource.current = "browser";
    workbench.open(splatToViewPath(splat));
  }, [workspaceId, splat, workbench]);

  // workbench active view -> browser URL
  useEffect(() => {
    if (!workspaceId || !activeView) {
      return;
    }

    if (syncSource.current === "browser") {
      syncSource.current = null;
      return;
    }

    const nextPath = buildBrowserPath(workspaceId, activeView.path);
    const currentPath = buildBrowserPath(workspaceId, splatToViewPath(splat));

    if (nextPath === currentPath) {
      return;
    }

    syncSource.current = "workbench";
    navigate(nextPath, { replace: true });
  }, [workspaceId, activeViewId, activeView?.path, navigate, splat]);
}
```

几个实现细节值得单独说明：

1. **`useParams()['*']`**：React Router v6 的 wildcard route `/workspace/:workspaceId/*` 会把 splat 段放进 `*` 这个 param。`/workspace/local/welcome` 得到 `splat = "welcome"`，`/workspace/local/all` 得到 `splat = "all"`。
2. **`syncSource` ref**：browser effect 跑完会 `workbench.open()`，这会改 `activeViewId$`；如果没有 ref，workbench effect 会再 `navigate()`，navigate 又触发 browser effect，形成死循环。AFFiNE 真实代码里也有类似的 source 标记。
3. **`nextPath === currentPath` 早退**：即使 source 标记正确，React StrictMode 或 LiveData 重复 set 也可能让 effect 多跑几次。比较目标 URL 和当前 URL 是第二道保险。
4. **`replace: true`**：学习版不做 view history，所以 workbench 切 tab 时用 replace 而不是 push。这意味着浏览器后退会直接离开 workspace，而不是在 workspace 内 tab 之间后退。这是已知限制，第 9 步引入 view history 后再改。

### 8.3 在 WorkbenchRoot 挂载 adapter

adapter 必须跑在 **workspace scope 内部**，因为它要读 `WorkbenchService`。`WorkspaceRoute` 只负责 open workspace，不应该知道 workbench 内部 path 怎么映射。

修改：

```text
packages/frontend/core/src/modules/workbench/workbench-root.tsx
```

在 `WorkbenchRoot` 顶部调用 hook：

```tsx
import { useBindWorkbenchToBrowserRouter } from "./use-bind-workbench-to-browser-router";

export function WorkbenchRoot() {
  useBindWorkbenchToBrowserRouter();

  const workbench = useService(WorkbenchService);
  // ... 其余不变
}
```

完整文件此时应如下：

```tsx
import { useService } from "~/src/framework/react";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useLiveData } from "~/src/shared/use-live-data";
import { useBindWorkbenchToBrowserRouter } from "./use-bind-workbench-to-browser-router";
import { WorkbenchService } from "./workbench-service";

export function WorkbenchRoot() {
  useBindWorkbenchToBrowserRouter();

  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;

  if (!activeView) {
    return null;
  }

  return (
    <section>
      <header>
        <div role="tablist" aria-label="Workbench views">
          {views.map((view) => (
            <span key={view.id}>
              <button
                type="button"
                role="tab"
                aria-selected={view.id === activeView.id}
                onClick={() => workbench.activate(view.id)}
              >
                {view.title}
              </button>
              <button
                type="button"
                aria-label={`Close ${view.title}`}
                disabled={views.length <= 1}
                onClick={() => workbench.close(view.id)}
              >
                Close
              </button>
            </span>
          ))}
        </div>

        <nav aria-label="Workspace tools">
          <button type="button" onClick={() => workbench.open("/all")}>
            All Docs
          </button>
          <button type="button" onClick={() => workbench.open("/settings")}>
            Settings
          </button>
        </nav>
      </header>

      <WorkbenchView path={activeView.path} />
    </section>
  );
}

function WorkbenchView({ path }: { path: string }) {
  if (path === "/all") {
    return <AllDocsPage />;
  }

  if (path === "/settings") {
    return <WorkspaceSettingsPage />;
  }

  return <DocPageContent docId={path.slice(1)} />;
}
```

### 8.4 这一节不需要改 router.tsx

`router.tsx` 在第 7 步已经改成 wildcard：

```tsx
{ path: "/workspace/:workspaceId/*", element: <WorkspaceRoute /> },
```

第 8 步只加 adapter hook，不再增加 nested children route。这也是 AFFiNE 的方向：browser router 只负责进 workspace，workspace 内部页面不再挂 React Router children。

### 8.5 验收

手动跑：

```bash
pnpm typecheck
pnpm malphite web dev
```

逐项检查：

1. 直接打开 `/workspace/local/welcome`（假设 welcome 是已存在 doc id），active tab 是 `welcome`，不是默认 `All Docs`。
2. 在 All Docs 点击某个 doc，地址栏变成 `/workspace/local/<docId>`。
3. 点击 Settings，地址栏变成 `/workspace/local/settings`。
4. 点击已有 doc 的 tab，地址栏跟着变，不会重复开 tab。
5. 控制台没有 `Maximum update depth exceeded` 或 navigate loop 警告。
6. 刷新 `/workspace/local/settings`，仍然停在 settings view，workspace scope 会重建但 view path 从 URL 恢复。
7. 浏览器后退：学习版会直接离开 workspace 或跳到上一个 browser history entry，**不会**在 workspace tab 之间后退——这是预期限制。

已知限制（学习版刻意不做）：

```text
- 浏览器前进/后退不会在 workspace 内恢复 tab 历史
- 每个 view 还没有独立的 location/search/hash
- close tab 不会改 browser URL（除非关闭的是 active tab）
- 不支持 /workspace/local 省略 /all 的 canonical URL
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/browser-adapter.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/workbench-root.tsx
```

读 AFFiNE 时重点看：

```text
1. basename 怎么从 workspace id 拼出来
2. browser location 怎么映射成 view location
3. 变更来源标记放在哪一层
4. 为什么 close view / push view history 时要分情况 navigate
```

---

## 9. 引入 per-view router 和 view scope

目标：接近 AFFiNE 的 `ViewRoot`，但继续保持小。

第 8 步之后，`WorkbenchView` 还是一个简单的 `if/else` 路由：

```tsx
function WorkbenchView({ path }: { path: string }) {
  if (path === "/all") return <AllDocsPage />;
  if (path === "/settings") return <WorkspaceSettingsPage />;
  return <DocPageContent docId={path.slice(1)} />;
}
```

这足够理解 workbench 主线，但有三个问题会在你加功能时很快暴露：

```text
1. View 只是 plain object，path 不是 LiveData，没法做 view 内 navigate
2. 所有 page 共享同一个 workspace child provider，没有 per-view scope
3. WorkbenchRoot 同时管 tab UI 和 page routing，职责开始变多
```

第 9 步做三件事：

```text
1. 把 View 升级成 class，path 变成 path$
2. 给每个 view 建 child provider + ViewScope（通过 useViewScope hook）
3. 把 page routing 从 WorkbenchRoot 抽到 ViewRoot
```

### 9.1 新增 View 类

新增：

```text
packages/frontend/core/src/modules/workbench/view.ts
```

```ts
import { LiveData } from "~/src/shared/live-data";

function normalizePath(path: string) {
  if (path === "" || path === "/") {
    return "/all";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function getViewTitle(path: string) {
  if (path === "/all") {
    return "All Docs";
  }

  if (path === "/settings") {
    return "Settings";
  }

  return path.slice(1);
}

export class View {
  path$ = new LiveData("");

  constructor(
    public readonly id: string,
    initialPath: string,
    public readonly title: string,
  ) {
    this.path$.set(normalizePath(initialPath));
  }

  get path() {
    return this.path$.value;
  }

  navigate(path: string) {
    this.path$.set(normalizePath(path));
  }
}

export function createView(path: string) {
  const normalizedPath = normalizePath(path);

  return new View(
    crypto.randomUUID(),
    normalizedPath,
    getViewTitle(normalizedPath),
  );
}

export const MAIN_VIEW = new View("main", "/all", "All Docs");
```

这样你会自然理解 AFFiNE 的：

```text
View.location$   -> 我们先用 path$ 代替
View.history     -> 第 9 步之后再加
View.scope       -> 下一节 ViewScope + child provider
```

### 9.2 重写 WorkbenchService 使用 View 类

修改：

```text
packages/frontend/core/src/modules/workbench/workbench-service.ts
```

把 plain object 版本替换成：

```ts
import { LiveData } from "~/src/shared/live-data";
import { createView, MAIN_VIEW, type View } from "./view";

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  get activeView(): View | undefined {
    return (
      this.views$.value.find((view) => view.id === this.activeViewId$.value) ??
      this.views$.value[0]
    );
  }

  open(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (normalizedPath === "" || normalizedPath === "/") {
      return this.open("/all");
    }

    const existing = this.views$.value.find((view) => {
      return view.path === normalizedPath;
    });

    if (existing) {
      this.activeViewId$.set(existing.id);
      return existing;
    }

    const view = createView(normalizedPath);

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);

    return view;
  }

  activate(id: string) {
    const exists = this.views$.value.some((view) => {
      return view.id === id;
    });

    if (exists) {
      this.activeViewId$.set(id);
    }
  }

  close(id: string) {
    const views = this.views$.value;

    if (views.length <= 1) {
      return;
    }

    const closedIndex = views.findIndex((view) => {
      return view.id === id;
    });

    if (closedIndex === -1) {
      return;
    }

    const nextViews = views.filter((view) => {
      return view.id !== id;
    });

    this.views$.set(nextViews);

    if (this.activeViewId$.value === id) {
      const nextActiveView =
        nextViews[Math.min(closedIndex, nextViews.length - 1)];
      this.activeViewId$.set(nextActiveView?.id ?? "");
    }
  }
}
```

对外 API 不变：`open` / `activate` / `close` 的调用方（`AllDocsPage`、adapter hook）不需要改。

### 9.3 新增 ViewScope

新增：

```text
packages/frontend/core/src/modules/workbench/view-scope.ts
```

```ts
import type { View } from "./view";

export class ViewScope {
  constructor(public readonly view: View) {}
}
```

这和 `WorkspaceScope` 是同一模式：

```text
WorkspaceScope  -> 当前 workspace 是谁
ViewScope         -> 当前 view 是谁
```

以后某个 service 只应该在“当前 view”里存在，就注册到 view child provider，而不是 workspace provider。例如 scroll position、sidebar 折叠状态、view 内临时 UI state。

### 9.4 新增 useViewScope 和 ViewRoot

不要把 `createChild` 放在 `useMemo` 里、再用 `useEffect` dispose。这和第 2 步
`useWorkspaceScope` 要避开的反模式一样，在 StrictMode 下会出问题：

```text
useMemo 在 render 阶段创建 viewProvider
useEffect cleanup 在 StrictMode 下 dispose 它
StrictMode 重跑 effect 时，useMemo 仍返回同一个已 dispose 的 provider
```

正确做法：把 **创建和销毁都放在同一个 effect 里**，用 `useState` 持有
provider。模式和 `useWorkspaceScope` 完全一致。

先新增 hook：

```text
packages/frontend/core/src/modules/workbench/use-view-scope.ts
```

```tsx
import { useEffect, useState } from "react";
import type { FrameworkProvider } from "~/src/framework/framework";
import { useFrameworkProvider } from "~/src/framework/react";
import { ViewScope } from "./view-scope";
import type { View } from "./view";

export function useViewScope(view: View) {
  const workspaceProvider = useFrameworkProvider();
  const [viewProvider, setViewProvider] = useState<FrameworkProvider | null>(
    null,
  );

  useEffect(() => {
    const provider = workspaceProvider.createChild((framework) => {
      framework.service(ViewScope, () => new ViewScope(view));
    });
    setViewProvider(provider);

    return () => {
      provider.dispose();
      setViewProvider(null);
    };
  }, [workspaceProvider, view]);

  return viewProvider;
}
```

StrictMode 下 effect 会 `create → dispose → create`，每次都拿到全新的
provider，不会复用已 dispose 的对象。

再新增 ViewRoot：

```text
packages/frontend/core/src/modules/workbench/view-root.tsx
```

学习版先不用 `UNSAFE_LocationContext`，也不接 memory router。每个 view 用自己的
`path$` + 条件渲染，但包一层 child provider：

```tsx
import { FrameworkRoot } from "~/src/framework/react";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useLiveData } from "~/src/shared/use-live-data";
import { useViewScope } from "./use-view-scope";
import type { View } from "./view";

function ViewContent({ path }: { path: string }) {
  if (path === "/all") {
    return <AllDocsPage />;
  }

  if (path === "/settings") {
    return <WorkspaceSettingsPage />;
  }

  return <DocPageContent docId={path.slice(1)} />;
}

export function ViewRoot({ view }: { view: View }) {
  const viewProvider = useViewScope(view);
  const path = useLiveData(view.path$);

  if (!viewProvider) {
    return null;
  }

  return (
    <FrameworkRoot framework={viewProvider}>
      <ViewContent path={path} />
    </FrameworkRoot>
  );
}
```

`viewProvider` 为 `null` 时返回 `null`，是因为 effect 还没跑完。这和
`useWorkspaceScope` 返回 `null` 再显示 "Loading workspace..." 是同一思路；学习版
可以先省略 loading UI。

这里刻意保留 `if/else` 路由。等你能解释清楚下面这条链，再读 AFFiNE 用 memory
router 的版本：

```text
view.path$
  -> ViewRoot 订阅 path
  -> ViewContent 条件渲染 page
  -> page 通过 useService 读 workspace 级 service
  -> 需要 view 级 state 时读 ViewScope
```

生命周期对照：

```text
useWorkspaceScope   -> workspace child provider
useViewScope        -> view child provider（嵌在 workspace scope 内）

WorkspaceRoute unmount
  -> dispose workspace provider
  -> 其下所有 view provider 随 React 树卸载而 dispose

关闭某个 tab
  -> 对应 ViewRoot unmount
  -> useViewScope cleanup dispose 该 tab 的 view provider
  -> workspace scope 不受影响
```

### 9.5 更新 WorkbenchRoot 和 browser adapter

第 9 步完成后，`WorkbenchRoot` 的职责进一步收缩：

```text
before（第 7–8 步）:
  tab UI + WorkbenchView（if/else 路由）+ page import

after（第 9 步）:
  tab UI + ViewRoot
  不再 import AllDocsPage / DocPageContent / WorkspaceSettingsPage
```

#### 9.5.1 重写 WorkbenchRoot

修改：

```text
packages/frontend/core/src/modules/workbench/workbench-root.tsx
```

完整实现：

```tsx
import { useService } from "~/src/framework/react";
import { useLiveData } from "~/src/shared/use-live-data";
import { useBindWorkbenchToBrowserRouter } from "./use-bind-workbench-to-browser-router";
import { ViewRoot } from "./view-root";
import { WorkbenchService } from "./workbench-service";

export function WorkbenchRoot() {
  useBindWorkbenchToBrowserRouter();

  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;

  if (!activeView) {
    return null;
  }

  return (
    <section>
      <header>
        <div role="tablist" aria-label="Workbench views">
          {views.map((view) => (
            <span key={view.id}>
              <button
                type="button"
                role="tab"
                aria-selected={view.id === activeView.id}
                onClick={() => workbench.activate(view.id)}
              >
                {view.title}
              </button>
              <button
                type="button"
                aria-label={`Close ${view.title}`}
                disabled={views.length <= 1}
                onClick={() => workbench.close(view.id)}
              >
                Close
              </button>
            </span>
          ))}
        </div>

        <nav aria-label="Workspace tools">
          <button type="button" onClick={() => workbench.open("/all")}>
            All Docs
          </button>
          <button type="button" onClick={() => workbench.open("/settings")}>
            Settings
          </button>
        </nav>
      </header>

      <ViewRoot view={activeView} />
    </section>
  );
}
```

和上一版相比，变化只有两处：

```text
1. 删掉 WorkbenchView 和三个 page import
2. activeView 改用 workbench.activeView getter，不再 inline find
```

#### 9.5.2 更新 browser adapter 订阅 path$

`View` 升级成 class 后，`path` 存在 `path$` 里。第 8 步 adapter 用
`activeView.path`（getter）做 workbench -> browser 同步，在 **tab 切换** 时够用；
但如果以后 view 内调用 `view.navigate()`，getter 不会触发 React 重渲染，URL
就不会跟着变。

修改：

```text
packages/frontend/core/src/modules/workbench/use-bind-workbench-to-browser-router.ts
```

完整重写：

```tsx
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { LiveData } from "~/src/shared/live-data";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

// useLiveData 不能条件调用，activeView 为空时用这个占位
const EMPTY_PATH$ = new LiveData("");

function splatToViewPath(splat: string | undefined) {
  if (!splat) {
    return "/all";
  }

  return splat.startsWith("/") ? splat : `/${splat}`;
}

function viewPathToSplat(viewPath: string) {
  if (viewPath === "/all") {
    return "all";
  }

  return viewPath.startsWith("/") ? viewPath.slice(1) : viewPath;
}

function buildBrowserPath(workspaceId: string, viewPath: string) {
  const splat = viewPathToSplat(viewPath);
  return `/workspace/${workspaceId}/${splat}`;
}

export function useBindWorkbenchToBrowserRouter() {
  const navigate = useNavigate();
  const { workspaceId, "*": splat } = useParams();
  const workbench = useService(WorkbenchService);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;
  const activeViewPath = useLiveData(activeView?.path$ ?? EMPTY_PATH$);

  const syncSource = useRef<"browser" | "workbench" | null>(null);

  // browser URL -> workbench active view
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    if (syncSource.current === "workbench") {
      syncSource.current = null;
      return;
    }

    syncSource.current = "browser";
    workbench.open(splatToViewPath(splat));
  }, [workspaceId, splat, workbench]);

  // workbench active view -> browser URL
  useEffect(() => {
    if (!workspaceId || !activeView) {
      return;
    }

    if (syncSource.current === "browser") {
      syncSource.current = null;
      return;
    }

    const nextPath = buildBrowserPath(workspaceId, activeViewPath);
    const currentPath = buildBrowserPath(workspaceId, splatToViewPath(splat));

    if (nextPath === currentPath) {
      return;
    }

    syncSource.current = "workbench";
    navigate(nextPath, { replace: true });
  }, [workspaceId, activeViewId, activeViewPath, navigate, splat, activeView]);
}
```

和 §8.2 版本的关键差异：

```text
1. 新增 EMPTY_PATH$ 占位，避免 activeView 为空时条件调用 useLiveData
2. workbench -> browser effect 依赖 activeViewPath（来自 path$），不是 activeView.path
3. buildBrowserPath 的参数改用 activeViewPath
```

这样 tab 切换（`activeViewId$` 变）和 view 内 navigate（`path$` 变）都会同步到
browser URL。第 9 步虽然还没做 view 内 navigate，但 adapter 先写对，后面加功能不用
再改。

#### 9.5.3 这一节不需要改的文件

```text
router.tsx          -> 仍是 /workspace/:workspaceId/* wildcard
workspace-route.tsx -> 仍只 open workspace + 渲染 WorkbenchRoot
AllDocsPage         -> 仍通过 workbench.open() 打开 doc，不直接 navigate
ViewRoot            -> §9.4 已实现，本节只被 WorkbenchRoot 引用
```

### 9.6 可选：证明 ViewScope 有用的最小例子

加一条 view 级 service，可以直观验证 **per-view scope 真的独立**，而不是所有 tab
共享同一份 UI state。

#### 9.6.1 新增 ViewUiService

新增：

```text
packages/frontend/core/src/modules/workbench/view-ui-service.ts
```

```ts
import { LiveData } from "~/src/shared/live-data";

export class ViewUiService {
  sidebarCollapsed$ = new LiveData(false);

  toggleSidebar() {
    this.sidebarCollapsed$.set(!this.sidebarCollapsed$.value);
  }
}
```

这是典型的 view 级 state：sidebar 折叠状态应该属于某个 tab，不应该在 tab 之间共享。

#### 9.6.2 在 useViewScope 里注册

修改：

```text
packages/frontend/core/src/modules/workbench/use-view-scope.ts
```

```tsx
import { useEffect, useState } from "react";
import type { FrameworkProvider } from "~/src/framework/framework";
import { useFrameworkProvider } from "~/src/framework/react";
import type { View } from "./view";
import { ViewScope } from "./view-scope";
import { ViewUiService } from "./view-ui-service";

export function useViewScope(view: View) {
  const workspaceProvider = useFrameworkProvider();
  const [viewProvider, setViewProvider] = useState<FrameworkProvider | null>(
    null,
  );

  useEffect(() => {
    const provider = workspaceProvider.createChild((framework) => {
      framework
        .service(ViewScope, () => new ViewScope(view))
        .service(ViewUiService, () => new ViewUiService());
    });

    setViewProvider(provider);

    return () => {
      provider.dispose();
      setViewProvider(null);
    };
  }, [workspaceProvider, view]);

  return viewProvider;
}
```

每个 tab 的 `ViewRoot` 各自调用 `useViewScope`，因此每个 tab 有独立的
`ViewUiService` 实例。

#### 9.6.3 在 AllDocsPage 里消费

修改：

```text
packages/frontend/core/src/pages/workspace/all-docs-page.tsx
```

```tsx
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { WorkbenchService } from "~/src/modules/workbench/workbench-service";
import { ViewUiService } from "~/src/modules/workbench/view-ui-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function AllDocsPage() {
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
  const workbench = useService(WorkbenchService);
  const viewUi = useService(ViewUiService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);
  const sidebarCollapsed = useLiveData(viewUi.sidebarCollapsed$);

  function createDoc() {
    const doc = docService.create("Untitled");
    workbench.open(`/${doc.id}`);
  }

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  return (
    <section>
      <h1>{workspace.name}</h1>

      <button type="button" onClick={() => viewUi.toggleSidebar()}>
        {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      </button>

      {!sidebarCollapsed && (
        <aside>
          <p>Sidebar (view-scoped)</p>
        </aside>
      )}

      <button type="button" onClick={createDoc}>
        New Doc
      </button>

      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <button type="button" onClick={() => workbench.open(`/${doc.id}`)}>
              {doc.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

注意 `AllDocsPage` 同时读了两种 scope 的 service：

```text
WorkspaceService / DocService / WorkbenchService  -> workspace scope（所有 tab 共享）
ViewUiService                                     -> view scope（每个 tab 独立）
```

#### 9.6.4 手动验证

```text
1. 打开 /workspace/local/all
2. 点击 "Collapse sidebar"，sidebar 消失
3. 打开两个 doc tab（例如 welcome 和另一个 doc）
4. 在 tab A 折叠 sidebar
5. 切到 tab B -> sidebar 应该仍是展开状态
6. 在 tab B 折叠 sidebar
7. 切回 tab A -> sidebar 应该仍是折叠状态
8. 关闭 tab A -> 只 dispose tab A 的 ViewUiService，tab B 不受影响
```

如果两个 tab 的 sidebar 状态互不影响，说明 view child provider 边界是正确的。
这个例子很小，但能直接证明 **per-view scope 不是过度设计**。

### 9.7 验收

1. 所有第 8 步验收项仍然通过。
2. 打开两个 doc tab，各自 `ViewScope` 和 `viewProvider` 独立创建、独立 dispose。
3. 关闭某个 tab 时，只 dispose 那个 view 的 child provider，workspace scope 不受影响。
4. 如果实现了 `ViewUiService` 例子，两个 tab 的 sidebar 状态互不影响。
5. `WorkbenchRoot` 文件里不再出现 page import，只剩 tab UI + `ViewRoot`。
6. 在 StrictMode 下打开/关闭 tab、切换 workspace，控制台无 provider 相关报错，无 service 状态串扰。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/view-root.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/scopes/view.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/entities/view.ts
```

AFFiNE 真实版本额外做了：

```text
每个 view 有自己的 memory router（createMemoryRouter）
每个 view 可以 push/replace/go/back
每个 view 有 location.pathname + search + hash
ViewRoot 用 UNSAFE_LocationContext 把 memory router 注入 React Router 子树
```

学习版先不用 memory router，是因为你还没有 view history 的需求。等第 9 步的 scope 边界清楚后，加 memory router 只是换 `ViewContent` 的实现，不会推翻 workspace/workbench 结构。

---

## 10. 再读 AFFiNE，不要全仓库乱逛

每次只带一个问题读源码。读完用固定模板写摘要。写不出摘要时，不要继续读——说明当前 toy version 还缺一块，回到项目里先补更小的实现。

### 10.1 摘要模板

```text
文件：
职责：
依赖：
输出：
它解决的痛点：
当前项目对应 toy version：
下一步是否 worth 实现：
```

### 10.2 示例：读 browser-adapter 时应写出什么

```text
文件：
  packages/frontend/core/src/modules/workbench/view/browser-adapter.ts

职责：
  在 workspace 生命周期内，绑定 browser URL 和 workbench active view location

依赖：
  WorkbenchService / Workbench entity
  react-router navigate + location
  workspace id 作为 basename

输出：
  一个 hook 或 effect：URL 变 -> active view 变；active view 变 -> URL 变

它解决的痛点：
  用户刷新、分享链接、浏览器后退时，workspace 内 tab 状态和 URL 不一致

当前项目对应 toy version：
  use-bind-workbench-to-browser-router.ts
  splat <-> view path 映射
  syncSource ref 防 loop

下一步是否 worth 实现：
  是，但先不要抄 view history；等 view class + ViewRoot 稳定后再加 push/replace 语义
```

如果你读 AFFiNE 的 `ViewRoot` 写不出这个级别的摘要，说明第 9 步还没做透，不要跳到 BlockSuite 或 nbstore。

### 10.3 当前项目 checkpoint

开始读 AFFiNE 前，确认自己的项目已经能回答这些问题：

| 问题 | 你的 toy version 应该能指到哪里 |
| --- | --- |
| app 入口为什么薄 | `packages/frontend/app/web/src/index.tsx` |
| 平台能力谁提供 | web app 注册 `DocStorageProvider` |
| workspace 怎么 open/dispose | `WorkspacesService.open` + `useWorkspaceScope` |
| workspace 内 service 存在哪 | workspace child provider |
| doc 数据怎么加载 | async `DocStorageDriver` + `DocService.ready$` |
| worker 存储怎么接 | `WorkerDocStorageDriver` + `doc-storage.worker.ts` |
| workspace 内多 tab 谁管 | `WorkbenchService` |
| tab UI 谁渲染 | `WorkbenchRoot` |
| URL 和 tab 怎么同步 | `useBindWorkbenchToBrowserRouter` |
| 每个 tab 的 scope | `useViewScope` + `ViewRoot` + `ViewScope` |

有任意一行答不上来，就先补那一块，不要开 AFFiNE 新目录。

### 10.4 阅读顺序

| 问题 | 先读 |
| --- | --- |
| web 入口为什么薄 | `packages/frontend/apps/web/src/index.tsx` |
| app 如何装配平台能力 | `packages/frontend/apps/web/src/app.tsx` |
| setup 做什么 | `packages/frontend/apps/web/src/setup.ts` |
| common modules 如何注册 | `packages/frontend/core/src/modules/index.ts` |
| provider/cache 怎么工作 | `packages/common/infra/src/framework/core/provider.ts` |
| React 怎么拿 service | `packages/common/infra/src/framework/react/index.tsx` |
| LiveData 如何接 React | `packages/common/infra/src/livedata/react.ts` |
| workspace 为什么要 scope | `packages/frontend/core/src/modules/workspace/index.ts` |
| workspace 页面如何 open/dispose | `packages/frontend/core/src/desktop/pages/workspace/index.tsx` |
| workspace list/open 是怎么拆的 | `packages/frontend/core/src/modules/workspace/services/workspaces.ts`、`repo.ts`、`factory.ts` |
| workspace entity 管什么 | `packages/frontend/core/src/modules/workspace/entities/workspace.ts` |
| workspace 内部路由有哪些 | `packages/frontend/core/src/desktop/workbench-router.ts` |
| WorkbenchService 为什么包一层 entity | `packages/frontend/core/src/modules/workbench/services/workbench.ts` |
| Workbench 核心状态是什么 | `packages/frontend/core/src/modules/workbench/entities/workbench.ts` |
| View 为什么有 history/scope | `packages/frontend/core/src/modules/workbench/entities/view.ts` |
| WorkbenchRoot 如何渲染多 view | `packages/frontend/core/src/modules/workbench/view/workbench-root.tsx` |
| Browser router 如何绑定 active view | `packages/frontend/core/src/modules/workbench/view/browser-adapter.ts` |
| ViewRoot 如何运行 per-view router | `packages/frontend/core/src/modules/workbench/view/view-root.tsx` |
| worker 存储如何接入 | `packages/frontend/apps/web/src/nbstore.worker.ts` |
| RPC client/consumer 怎么抽象 | `packages/common/infra/src/op/client.ts`、`consumer.ts` |

写不出摘要时，不要继续读。回到当前项目补一个更小的 toy implementation。

---

## 11. 推荐提交顺序

每个提交都要能独立运行。

1. 补齐 `/workspace/:workspaceId/settings` 页面和 route。
2. 增加 `WorkspaceRef`，把 workspace open/dispose 从 React 组件收回 `WorkspacesService`。
3. 增加 `useWorkspaceScope`，在 effect 里 open/dispose，避免 StrictMode 泄漏。
4. 增加 `DocStorageProvider`，让 web app 提供 localStorage driver。
5. 把 `DocStorageDriver` 改成 async，给 `DocService` 增加 `ready$` / `error$`。
6. 增加 worker RPC 类型和 `WorkerDocStorageDriver`。
7. 新增 `doc-storage.worker.ts`，先用 worker 内存 Map。
8. worker 内部改成 IndexedDB 持久化。
9. 增加 `WorkbenchRoot`，把 `WorkbenchService` 接到 UI。
10. 点击 doc 改为 `workbench.open(...)`，而不是直接依赖 `<Link>`。
11. router 改成 `/workspace/:workspaceId/*` wildcard，去掉 workspace nested children。
12. 增加 `useBindWorkbenchToBrowserRouter`，让 URL 和 active view 双向同步。
13. 把 plain `View` 升级成 class，增加 `path$` 和 `navigate()`。
14. 实现 `ViewScope` + `useViewScope` + `ViewRoot`，把 page routing 从 `WorkbenchRoot` 拆出去。
15. （可选）增加 `ViewUiService` 验证 per-view scope 真的独立。

第 8 步对应提交 12，第 9 步对应提交 13–15。不要在一个提交里同时做 adapter 和
View class，否则 loop 问题和 scope 问题混在一起很难 debug。

每个提交至少跑：

```bash
pnpm typecheck
pnpm malphite web dev
```

手动验收：

```text
/
/about
/workspace/local
/workspace/local/all
/workspace/local/welcome
/workspace/local/settings
/workspace/demo/all
```

关键行为：

1. 新建 doc 后刷新仍存在。
2. local/demo 数据不串。
3. 离开 workspace 会 dispose workspace scope。
4. worker storage 切换前后，页面层代码不需要知道 driver 是 localStorage 还是 worker。
5. Workbench 接入后，打开多个 doc 不会创建多个 workspace scope。
6. 第 8 步后：直接打开 `/workspace/local/<docId>` 会激活对应 tab，地址栏和 tab 一致。
7. 第 9 步后：关闭 tab 会 dispose 对应 view provider，不影响 workspace scope。

---

## 12. 抽象判断标准

不要因为 AFFiNE 有某个抽象就马上实现。

满足下面任一条件再抽：

1. 同类代码出现第二次。
2. 一个文件职责超过两个。
3. 某个逻辑未来需要被 web/electron/mobile 复用。
4. 测试或调试因为耦合变难。
5. 页面逻辑和业务逻辑开始互相污染。
6. 同步接口阻挡了真实平台能力，比如 worker、IndexedDB、网络。

当前项目下一层真正需要的是：

```text
platform provider
  -> workspace open ref
  -> async storage driver
  -> worker RPC
  -> workbench root
  -> view state
```

暂时不要实现：

```text
BlockSuite
Yjs doc collection
cloud sync
SharedWorker fallback matrix
telemetry
i18n
drag and drop
复杂 sidebar
多 server / self-hosted
完整 permission/share flow
```

这些都是真实 AFFiNE 必需的东西，但不是你现在理解主线所必需的东西。

---

## 13. 本阶段的核心心智模型

把 AFFiNE 先理解成几个层次，而不是一堆文件：

```text
App layer:
  浏览器入口、worker、平台能力注册

Framework layer:
  service factory、provider cache、scope、dispose

Workspace layer:
  workspace list、open ref、workspace scope、workspace services

Storage layer:
  main thread client、worker RPC、IndexedDB/cloud/local driver

Workbench layer:
  workspace 内多个 view、active view、view history、browser adapter

Document layer:
  doc metadata、doc content、editor/block model
```

你的项目现在卡在一个很好的位置：已经有了前四层的玩具版，但还没有让它们承受异步和多 view 的压力。下一轮学习的价值就在这里。

最重要的顺序：

```text
先让同步代码变成异步
再让异步代码跨 worker
先让普通 route 变成 workbench view
再让 view 拥有自己的 route/history/scope
```

这就是从 toy app 靠近 AFFiNE 的最短路径。
