# 从当前项目继续实现 AFFiNE 风格 Web

这份文档从当前仓库已经完成的代码继续，不再保留之前“从 DOM 到 React”的旧教程。

当前前置状态：

```text
packages/frontend/app/web
  src/index.tsx
  src/app.tsx
  src/setup.ts

packages/frontend/core
  src/components/app-shell.tsx
  src/router.tsx
  src/shared/live-state.ts
  src/shared/use-live-state.ts
  src/framework/framework.ts
  src/framework/react.tsx
  src/modules/index.ts
  src/modules/site/site-service.ts
  src/modules/workspace/workspace-service.ts
  src/pages/workspace-page.tsx
```

目标不是复制完整 AFFiNE，而是按更小的实现理解它：

```text
setup
  -> LiveState
  -> FrameworkProvider
  -> module registration
  -> workspace scope
  -> docs
  -> storage
  -> workbench
```

每一步都遵守同一个规则：

```text
先写最小可运行版本
再观察它解决了什么痛点
最后再对照 AFFiNE 的真实文件
```

---

## 1. 接入 setup

目标：让 `setup.ts` 成为浏览器 bootstrap 层，而不是一个空文件。

修改 `packages/frontend/app/web/src/index.tsx`：

```tsx
import "./setup";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

function mountApp() {
  const root = document.querySelector("#root");
  if (!root) {
    throw new Error("Root element #root not found");
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

try {
  mountApp();
} catch (error) {
  console.error("[malphite] failed to bootstrap app", error);
}
```

修改 `packages/frontend/app/web/src/setup.ts`：

```ts
console.info("[malphite] bootstrap browser environment");

window.addEventListener("error", (event) => {
  console.error("[malphite] uncaught error", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[malphite] unhandled rejection", event.reason);
});
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/index.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/setup.ts
```

AFFiNE 的 `setup.ts` 做的是浏览器环境、cleanup、theme 初始化。你的学习版先只做错误监听。

验收：

```bash
pnpm malphite web dev
```

浏览器控制台能看到 bootstrap 日志。

---

## 2. 升级 LiveState 和 useLiveState

目标：让响应式状态更接近 AFFiNE 的 `LiveData + useLiveData`，但先不引入 RxJS。

修改 `packages/frontend/core/src/shared/live-state.ts`：

```ts
type Listener = () => void;

export class LiveState<T> {
  private listeners = new Set<Listener>();

  constructor(private current: T) {}

  get value() {
    return this.current;
  }

  set(value: T) {
    if (Object.is(this.current, value)) {
      return;
    }

    this.current = value;

    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  map<R>(mapper: (value: T) => R) {
    const mapped = new LiveState(mapper(this.value));

    this.subscribe(() => {
      mapped.set(mapper(this.value));
    });

    return mapped;
  }
}
```

修改 `packages/frontend/core/src/shared/use-live-state.ts`：

```tsx
import { useSyncExternalStore } from "react";
import type { LiveState } from "./live-state";

export function useLiveState<T>(state: LiveState<T>) {
  return useSyncExternalStore(
    (listener) => state.subscribe(listener),
    () => state.value,
    () => state.value,
  );
}
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/livedata/livedata.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/livedata/react.ts
```

验收：

1. 首页 Rename 按钮仍然能触发渲染。
2. 连续设置同一个值不会重复通知。
3. 你能解释 `subscribe + getSnapshot` 为什么是外部 store 的最小协议。

---

## 3. 把 Framework 改成 provider/cache

目标：从“提前 new 好 instance”升级成“注册 factory，由 provider 懒创建并缓存”。

修改 `packages/frontend/core/src/framework/framework.ts`：

```ts
export type Constructor<T> = new (...args: any[]) => T;
export type Factory<T> = (provider: FrameworkProvider) => T;

export class Framework {
  private factories = new Map<Constructor<unknown>, Factory<unknown>>();

  service<T>(token: Constructor<T>, factory: Factory<T>) {
    this.factories.set(token, factory);
    return this;
  }

  provider(parent: FrameworkProvider | null = null) {
    return new FrameworkProvider(this, parent);
  }

  getFactory<T>(token: Constructor<T>) {
    return this.factories.get(token) as Factory<T> | undefined;
  }
}

export class FrameworkProvider {
  private cache = new Map<Constructor<unknown>, unknown>();

  constructor(
    private framework: Framework,
    private parent: FrameworkProvider | null = null,
  ) {}

  get<T>(token: Constructor<T>): T {
    if (this.cache.has(token)) {
      return this.cache.get(token) as T;
    }

    const factory = this.framework.getFactory(token);
    if (!factory) {
      if (this.parent) {
        return this.parent.get(token);
      }

      throw new Error(`Service not found: ${token.name}`);
    }

    const instance = factory(this);
    this.cache.set(token, instance);

    return instance;
  }

  createChild(configure: (framework: Framework) => void) {
    const childFramework = new Framework();
    configure(childFramework);
    return childFramework.provider(this);
  }

  dispose() {
    for (const instance of this.cache.values()) {
      const disposable = instance as { dispose?: () => void };
      disposable.dispose?.();
    }

    this.cache.clear();
  }
}
```

`createChild()` 创建的是一个空的 child framework。它只注册当前 scope 自己的 service；找不到的 service 通过 parent fallback 回到根 provider。这样 workspace scope 不会意外复制一份全局 service。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/framework/core/framework.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/framework/core/provider.ts
```

真实 AFFiNE 多了 `service/store/entity/impl/scope/variant`。先不要复制，先理解 provider cache。

验收：

1. 不调用 `provider.get(Service)` 时，service 不会创建。
2. 同一个 provider 多次 `get` 返回同一个实例。
3. `dispose()` 会清空当前 provider 的 cache。

---

## 4. React 层使用 FrameworkProvider

目标：React context 保存 provider，而不是保存 framework 注册表。

修改 `packages/frontend/core/src/framework/react.tsx`：

```tsx
import { createContext, type PropsWithChildren, useContext } from "react";
import type { Constructor, FrameworkProvider } from "./framework";

const FrameworkContext = createContext<FrameworkProvider | null>(null);

export function FrameworkRoot({
  framework,
  children,
}: PropsWithChildren<{ framework: FrameworkProvider }>) {
  return (
    <FrameworkContext.Provider value={framework}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useFrameworkProvider() {
  const provider = useContext(FrameworkContext);

  if (!provider) {
    throw new Error("FrameworkRoot is missing");
  }

  return provider;
}

export function useService<T>(token: Constructor<T>) {
  return useFrameworkProvider().get(token);
}
```

确认 `packages/frontend/core/src/index.ts` 导出这些能力：

```ts
export { AppShell } from "./components/app-shell";
export { Framework } from "./framework/framework";
export { FrameworkRoot, useFrameworkProvider, useService } from "./framework/react";
export { configureCommonModules } from "./modules";
export { router } from "./router";
```

验收：

页面仍然能通过 `useService(SiteService)` 拿到 service。

---

## 5. 重写模块注册

目标：`configureCommonModules` 注册 factory，而不是注册已经创建好的 instance。

修改 `packages/frontend/core/src/modules/index.ts`：

```ts
import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";

export function configureCommonModules(framework: Framework) {
  framework.service(SiteService, () => new SiteService());
}
```

后面每新增一个模块，都回到这个文件增量注册。不要在这里提前 import 还不存在的文件。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/index.ts
```

AFFiNE 的 `configureCommonModules(framework)` 是所有业务模块的入口。`web/src/app.tsx` 不应该知道每个业务模块内部怎么注册。

---

## 6. Web App 创建 provider

目标：web 包只做平台装配，不直接持有业务 service。

修改 `packages/frontend/app/web/src/app.tsx`：

```tsx
import {
  AppShell,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
configureCommonModules(framework);

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

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
```

真实 AFFiNE 在这里还装配了 storage worker、i18n、theme cache、telemetry、popup provider、lifecycle。你的学习版先只装配 framework provider。

---

## 7. 拆出 WorkspacesService 和 WorkspaceScope

目标：区分“workspace 列表服务”和“当前 workspace scope 内服务”。

新增 `packages/frontend/core/src/modules/workspace/workspaces-service.ts`：

```ts
import { LiveState } from "../../shared/live-state";

export type WorkspaceMeta = {
  id: string;
  name: string;
};

export class WorkspacesService {
  workspaces$ = new LiveState<WorkspaceMeta[]>([
    { id: "local", name: "Local Workspace" },
    { id: "demo", name: "Demo Workspace" },
  ]);

  get(id: string) {
    return this.workspaces$.value.find((workspace) => workspace.id === id);
  }
}
```

新增 `packages/frontend/core/src/modules/workspace/workspace-scope.ts`：

```ts
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceScope {
  constructor(public meta: WorkspaceMeta) {}
}
```

修改 `packages/frontend/core/src/modules/workspace/workspace-service.ts`：

```ts
import { WorkspaceScope } from "./workspace-scope";

export class WorkspaceService {
  constructor(private scope: WorkspaceScope) {}

  get id() {
    return this.scope.meta.id;
  }

  get name() {
    return this.scope.meta.name;
  }
}
```

回到 `packages/frontend/core/src/modules/index.ts`，注册 `WorkspacesService`：

```ts
import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";
import { WorkspacesService } from "./workspace/workspaces-service";

export function configureCommonModules(framework: Framework) {
  framework
    .service(SiteService, () => new SiteService())
    .service(WorkspacesService, () => new WorkspacesService());
}
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/services/workspaces.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/services/workspace.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/scopes/workspace.ts
```

验收：

你能说清楚：

```text
WorkspacesService -> 管全局 workspace 列表
WorkspaceService  -> 管当前 workspace scope
```

---

## 8. 创建 workspace scope root

目标：进入 `/workspace/:workspaceId` 时创建 child provider，离开时 dispose。

新增 `packages/frontend/core/src/pages/workspace-route.tsx`：

```tsx
import { type PropsWithChildren, useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { FrameworkRoot, useFrameworkProvider, useService } from "../framework/react";
import { useLiveState } from "../shared/use-live-state";
import { WorkspaceScope } from "../modules/workspace/workspace-scope";
import { WorkspaceService } from "../modules/workspace/workspace-service";
import { WorkspacesService } from "../modules/workspace/workspaces-service";

function WorkspaceScopeRoot({
  workspaceId,
  children,
}: PropsWithChildren<{ workspaceId: string }>) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveState(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const provider = useMemo(() => {
    if (!meta) {
      return null;
    }

    return root.createChild((framework) => {
      framework
        .service(WorkspaceScope, () => new WorkspaceScope(meta))
        .service(WorkspaceService, (provider) => {
          return new WorkspaceService(provider.get(WorkspaceScope));
        });
    });
  }, [meta, root]);

  useEffect(() => {
    return () => {
      provider?.dispose();
    };
  }, [provider]);

  if (!meta || !provider) {
    return <div>Workspace not found</div>;
  }

  return <FrameworkRoot framework={provider}>{children}</FrameworkRoot>;
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

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/index.tsx
```

真实 AFFiNE 的关键点：

```text
workspacesService.open(...)
  -> 返回 workspace ref
  -> ref.workspace.scope
  -> 页面卸载时 ref.dispose()
```

你的学习版先用 child provider 模拟这个行为。

---

## 9. 增加 DocStorage

目标：让文档数据依赖存储接口，而不是直接写死 localStorage。

新增 `packages/frontend/core/src/modules/storage/doc-storage-service.ts`：

```ts
import type { Doc } from "../doc/doc-service";

export type DocStorageDriver = {
  load(workspaceId: string): Doc[];
  save(workspaceId: string, docs: Doc[]): void;
};

export class DocStorageService {
  constructor(private driver: DocStorageDriver) {}

  load(workspaceId: string) {
    return this.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]) {
    this.driver.save(workspaceId, docs);
  }
}
```

新增 `packages/frontend/core/src/modules/storage/local-doc-storage-driver.ts`：

```ts
import type { Doc } from "../doc/doc-service";
import type { DocStorageDriver } from "./doc-storage-service";

export class LocalDocStorageDriver implements DocStorageDriver {
  load(workspaceId: string) {
    const raw = localStorage.getItem(`workspace:${workspaceId}:docs`);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  }

  save(workspaceId: string, docs: Doc[]) {
    localStorage.setItem(
      `workspace:${workspaceId}:docs`,
      JSON.stringify(docs),
    );
  }
}
```

回到 `packages/frontend/core/src/modules/index.ts`，注册存储服务：

```ts
import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";
import { DocStorageService } from "./storage/doc-storage-service";
import { LocalDocStorageDriver } from "./storage/local-doc-storage-driver";
import { WorkspacesService } from "./workspace/workspaces-service";

export function configureCommonModules(framework: Framework) {
  framework
    .service(SiteService, () => new SiteService())
    .service(WorkspacesService, () => new WorkspacesService())
    .service(DocStorageService, () => {
      return new DocStorageService(new LocalDocStorageDriver());
    });
}
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/nbstore.worker.ts
```

AFFiNE 是 worker + IndexedDB + cloud storage。你的学习版先只做 localStorage driver。

---

## 10. 增加 DocService

目标：workspace scope 内有自己的 docs。

新增 `packages/frontend/core/src/modules/doc/doc-service.ts`：

```ts
import { WorkspaceService } from "../workspace/workspace-service";
import { DocStorageService } from "../storage/doc-storage-service";
import { LiveState } from "../../shared/live-state";

export type Doc = {
  id: string;
  title: string;
  content: string;
};

export class DocService {
  docs$: LiveState<Doc[]>;

  constructor(
    private workspaceService: WorkspaceService,
    private storage: DocStorageService,
  ) {
    const stored = this.storage.load(this.workspaceService.id);
    this.docs$ = new LiveState(
      stored.length > 0
        ? stored
        : [{ id: "welcome", title: "Welcome", content: "Hello AFFiNE style" }],
    );
  }

  create(title: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title,
      content: "",
    };

    this.save([...this.docs$.value, doc]);

    return doc;
  }

  rename(id: string, title: string) {
    this.save(
      this.docs$.value.map((doc) => {
        return doc.id === id ? { ...doc, title } : doc;
      }),
    );
  }

  get(id: string) {
    return this.docs$.value.find((doc) => doc.id === id);
  }

  private save(docs: Doc[]) {
    this.docs$.set(docs);
    this.storage.save(this.workspaceService.id, docs);
  }
}
```

在第 8 步的 `WorkspaceScopeRoot` 里注册 `DocService`：

```ts
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
  });
```

别忘了 import：

```ts
import { DocService } from "../modules/doc/doc-service";
import { DocStorageService } from "../modules/storage/doc-storage-service";
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.tsx
```

---

## 11. 重写 workspace 路由

目标：workspace 内有 `all`、`:docId`、`settings` 三类页面。

修改 `packages/frontend/core/src/router.tsx`：

```tsx
import { Navigate, createBrowserRouter } from "react-router-dom";
import { useService } from "./framework/react";
import { SiteService } from "./modules/site/site-service";
import { WorkspaceRoute } from "./pages/workspace-route";
import { AllDocsPage } from "./pages/workspace/all-docs-page";
import { DocPage } from "./pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "./pages/workspace/settings-page";
import { useLiveState } from "./shared/use-live-state";

function HomePage() {
  const siteService = useService(SiteService);
  const title = useLiveState(siteService.title$);

  return (
    <div>
      <h1>{title}</h1>
      <button
        type="button"
        onClick={() => siteService.rename("Malphite is closer to AFFiNE")}
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
  {
    path: "/workspace/:workspaceId",
    element: <WorkspaceRoute />,
    children: [
      { index: true, element: <Navigate to="all" replace /> },
      { path: "all", element: <AllDocsPage /> },
      { path: "settings", element: <WorkspaceSettingsPage /> },
      { path: ":docId", element: <DocPage /> },
    ],
  },
]);
```

新增 `packages/frontend/core/src/pages/workspace/all-docs-page.tsx`：

```tsx
import { Link, useParams } from "react-router-dom";
import { useService } from "../../framework/react";
import { DocService } from "../../modules/doc/doc-service";
import { WorkspaceService } from "../../modules/workspace/workspace-service";
import { useLiveState } from "../../shared/use-live-state";

export function AllDocsPage() {
  const { workspaceId } = useParams();
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
  const docs = useLiveState(docService.docs$);

  return (
    <section>
      <h1>{workspace.name}</h1>
      <button type="button" onClick={() => docService.create("Untitled")}>
        New Doc
      </button>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <Link to={`/workspace/${workspaceId}/${doc.id}`}>{doc.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

新增 `packages/frontend/core/src/pages/workspace/doc-page.tsx`：

```tsx
import { useParams } from "react-router-dom";
import { useService } from "../../framework/react";
import { DocService } from "../../modules/doc/doc-service";
import { useLiveState } from "../../shared/use-live-state";

export function DocPage() {
  const { docId } = useParams();
  const docService = useService(DocService);
  const docs = useLiveState(docService.docs$);
  const doc = docs.find((item) => item.id === docId);

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

新增 `packages/frontend/core/src/pages/workspace/settings-page.tsx`：

```tsx
import { useService } from "../../framework/react";
import { WorkspaceService } from "../../modules/workspace/workspace-service";

export function WorkspaceSettingsPage() {
  const workspace = useService(WorkspaceService);

  return <h1>{workspace.name} settings</h1>;
}
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/workbench-router.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/all-page/all-page.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.tsx
```

验收：

```text
/workspace/local
/workspace/local/all
/workspace/local/welcome
/workspace/local/settings
```

这些路径都能工作。

---

## 12. 增加最小 Workbench

目标：理解为什么 AFFiNE 不只是普通嵌套路由。

新增 `packages/frontend/core/src/modules/workbench/workbench-service.ts`：

```ts
import { LiveState } from "../../shared/live-state";

export type View = {
  id: string;
  path: string;
};

export class WorkbenchService {
  views$ = new LiveState<View[]>([{ id: "main", path: "/all" }]);
  activeViewId$ = new LiveState("main");

  open(path: string) {
    const view = {
      id: crypto.randomUUID(),
      path,
    };

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);
  }

  close(id: string) {
    const next = this.views$.value.filter((view) => view.id !== id);
    this.views$.set(next);
    this.activeViewId$.set(next[0]?.id ?? "");
  }
}
```

先不要接 UI。只要理解：

```text
普通 router:
  一个 URL -> 一个页面

Workbench:
  一个 workspace -> 多个 view
  每个 view -> 自己的 path 和 UI 状态
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/workbench-root.tsx
```

真实 AFFiNE 的 `WorkbenchRoot` 会处理 `SplitView`、`ViewRoot`、sidebar、active view、browser/desktop adapter。你的学习版先只保留 `views$`。

---

## 13. worker 存储只做 RPC 学习版

目标：理解 AFFiNE 为什么把存储放到 worker。

不要一开始复制 `nbstore`。先只支持两个操作：

```text
loadDocs(workspaceId)
saveDocs(workspaceId, docs)
```

学习版主线程 client：

```ts
type RequestMessage = {
  id: string;
  method: "loadDocs" | "saveDocs";
  payload: unknown;
};

export function request<T>(
  worker: Worker,
  method: RequestMessage["method"],
  payload: unknown,
) {
  return new Promise<T>((resolve, reject) => {
    const id = crypto.randomUUID();

    const onMessage = (event: MessageEvent) => {
      if (event.data.id !== id) {
        return;
      }

      worker.removeEventListener("message", onMessage);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, method, payload });
  });
}
```

学习版 worker：

```ts
const docs = new Map<string, unknown[]>();

self.addEventListener("message", (event) => {
  const { id, method, payload } = event.data;

  if (method === "loadDocs") {
    const { workspaceId } = payload;
    self.postMessage({ id, result: docs.get(workspaceId) ?? [] });
    return;
  }

  if (method === "saveDocs") {
    const { workspaceId, docs: nextDocs } = payload;
    docs.set(workspaceId, nextDocs);
    self.postMessage({ id, result: null });
    return;
  }

  self.postMessage({ id, error: `Unknown method: ${method}` });
});
```

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/nbstore.worker.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/op/client.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/op/consumer.ts
```

理解重点：

```text
main thread client
  -> request message
  -> worker consumer
  -> storage implementation
  -> response message
```

---

## 14. 按问题阅读 AFFiNE

不要全量读 `/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src`。按问题读文件。

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
| workspace 内部路由有哪些 | `packages/frontend/core/src/desktop/workbench-router.ts` |
| Workbench 解决什么 | `packages/frontend/core/src/modules/workbench/view/workbench-root.tsx` |
| worker 存储如何接入 | `packages/frontend/apps/web/src/nbstore.worker.ts` |

每读一个文件，写这个摘要：

```text
文件：
职责：
依赖：
输出：
它解决的痛点：
当前项目对应的学习版：
```

写不出来就暂停读源码，回到当前项目补一个更小的 toy implementation。

---

## 15. 推荐提交顺序

按这个顺序提交，每一步都能独立运行：

1. 接入 `setup.ts`。
2. 升级 `LiveState` / `useLiveState`。
3. 改造 `Framework` 为 provider/cache。
4. React context 改成保存 provider。
5. `configureCommonModules` 改成注册 factory。
6. `web/src/app.tsx` 创建 `frameworkProvider`。
7. 拆出 `WorkspacesService` / `WorkspaceScope` / `WorkspaceService`。
8. 增加 `WorkspaceRoute` 和 child provider。
9. 增加 `DocStorageService` 和 localStorage driver。
10. 增加 `DocService`。
11. 重写 workspace 内部路由。
12. 增加最小 `WorkbenchService`。
13. 再考虑 worker RPC 学习版。

每一步验收：

```bash
pnpm malphite web dev
```

至少确认：

1. 首页能打开。
2. `/about` 能打开。
3. `/workspace/local/all` 能打开。
4. 新建 doc 后刷新仍然存在。
5. 切换 `/workspace/local` 和 `/workspace/demo` 时数据不串。

---

## 16. 抽象判断标准

不要因为 AFFiNE 有某个抽象就马上实现。

满足下面任一条件再抽：

1. 同类代码出现第二次。
2. 一个文件职责超过两个。
3. 某个逻辑未来需要被 web/electron/mobile 复用。
4. 测试或调试因为耦合变难。
5. 页面逻辑和业务逻辑开始互相污染。

当前项目下一层真正需要的是：

```text
provider/cache
  -> workspace scope
  -> doc service
  -> storage driver
```

worker、Workbench、Yjs、BlockSuite 都应该在这些跑通后再学。
