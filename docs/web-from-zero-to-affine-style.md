# 从 0 到 1 实现 Web：按 AFFiNE 的抽象路线学习

这份文档不是直接讲 AFFiNE 源码。AFFiNE 现在的代码已经经过很多轮抽象：入口很薄、业务在 `@affine/core`、模块靠 DI 注册、workspace 有独立 scope、存储放在 worker 里。直接读最终形态会很难。

这里采用反向学习法：

1. 先实现一个能跑的最小 Web。
2. 再按痛点逐步抽象。
3. 每一步只引入一个新概念。
4. 最后再回头对应 AFFiNE 的真实文件。

当前你的项目已经有这些基础：

```text
packages/frontend/app/web/
  index.html
  src/index.tsx
  package.json

packages/frontend/core/
  package.json

tools/cli/
  bundle.ts
  vite/index.ts
  run.ts

docs/
  vite8-rolldown-bundle-guide.md
```

所以这份文档默认你已经能通过 CLI 启动 Web：

```bash
pnpm malphite web dev
```

如果这条命令失败，也可以临时直接进入 web 包启动 Vite，等 CLI 修好后再切回来。

---

## 总目标

我们最终要把当前最小页面：

```ts
const root = document.querySelector("#root");

if (root) {
  root.textContent = "Malphite web app";
}
```

逐步演进成类似 AFFiNE 的结构：

```text
web/src/index.tsx
  -> setup
  -> render <App />

web/src/app.tsx
  -> create framework
  -> configure modules
  -> configure storage
  -> render router

core/src/
  -> components
  -> router
  -> modules
  -> services
  -> workspace
```

但不要一开始就实现完整 AFFiNE。学习顺序应该是：

```text
页面能跑
  -> 组件化
  -> app 入口
  -> core 包
  -> 路由
  -> 状态服务
  -> 简易模块系统
  -> workspace 概念
  -> worker 存储
```

---

## 第 1 阶段：只实现一个能跑的 Web

目标：确认 `@mlphite/web` 可以被 Vite 启动。

当前文件：

```text
packages/frontend/app/web/index.html
packages/frontend/app/web/src/index.tsx
```

先保持最简单：

```ts
const root = document.querySelector("#root");

if (root) {
  root.textContent = "Malphite web app";
}
```

这一阶段不要引入 React、router、core、DI。

你只需要确认：

1. 浏览器能打开页面。
2. 修改 `index.tsx` 后页面能热更新。
3. `pnpm malphite web dev` 能通过你的 CLI 调到 `malphite bundle --dev`。

对应你当前代码：

```text
tools/cli/src/run.ts
  -> 解析 pnpm malphite web dev
  -> 找到 @mlphite/web 的 scripts.dev
  -> dev = malphite bundle --dev
  -> 转成 bundle --dev -p @mlphite/web

tools/cli/src/bundle.ts
  -> createServer(createHTMLTargetConfig(pkg))
```

此时学到的东西：

- CLI 如何找到 package。
- Vite 如何把 `index.html` 作为入口。
- Web 最小入口长什么样。

---

## 第 2 阶段：把页面逻辑从 DOM 操作变成 App 函数

痛点：所有逻辑都写在 `index.tsx`，后面会越来越乱。

先不要上 React，只抽一个函数。

把 `packages/frontend/app/web/src/index.tsx` 改成：

```ts
function App() {
  const el = document.createElement("main");
  el.innerHTML = `
    <h1>Malphite</h1>
    <p>一个从零开始实现的 Web 应用。</p>
  `;
  return el;
}

function mountApp() {
  const root = document.querySelector("#root");
  if (!root) {
    throw new Error("Root element #root not found");
  }

  root.replaceChildren(App());
}

mountApp();
```

这一阶段只做一个抽象：

```text
index.tsx 不再直接写页面
index.tsx 负责 mount
App 负责描述 UI
```

这对应 AFFiNE：

```text
packages/frontend/apps/web/src/index.tsx
  -> mountApp()
  -> render <App />
```

---

## 第 3 阶段：拆出 app.ts

痛点：`index.tsx` 同时负责启动和 UI。

新增：

```text
packages/frontend/app/web/src/app.ts
```

`app.ts`：

```ts
export function App() {
  const el = document.createElement("main");
  el.innerHTML = `
    <h1>Malphite</h1>
    <p>App 已经从入口文件拆出来。</p>
  `;
  return el;
}
```

`index.tsx`：

```ts
import { App } from "./app";

function mountApp() {
  const root = document.querySelector("#root");
  if (!root) {
    throw new Error("Root element #root not found");
  }

  root.replaceChildren(App());
}

mountApp();
```

现在结构变成：

```text
web/src/index.tsx  只负责启动
web/src/app.ts     负责应用主体
```

对应 AFFiNE：

```text
web/src/index.tsx
web/src/app.tsx
```

---

## 第 4 阶段：引入 React，但先不要引入 router

痛点：手写 DOM 会很快失控。

安装依赖：

```bash
pnpm add react react-dom --filter @mlphite/web
pnpm add -D @types/react @types/react-dom --filter @mlphite/web
```

把 `app.ts` 改成 `app.tsx`：

```tsx
export function App() {
  return (
    <main>
      <h1>Malphite</h1>
      <p>现在 App 已经由 React 渲染。</p>
    </main>
  );
}
```

`index.tsx`：

```tsx
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

mountApp();
```

此时不要拆组件库，不要做 layout，不要接状态管理。

这一阶段只学习：

- React 根节点如何挂载。
- `index.tsx` 和 `App` 的职责边界。

对应 AFFiNE：

```text
web/src/index.tsx
  -> createRoot(root).render(...)
```

---

## 第 5 阶段：增加 setup.ts

痛点：入口后续会有全局初始化，比如环境变量、主题、polyfill、错误处理。

新增：

```text
packages/frontend/app/web/src/setup.ts
```

先写最小内容：

```ts
console.info("[malphite] setup web environment");
```

`index.tsx` 顶部引入：

```ts
import "./setup";
```

此时结构：

```text
web/src/setup.ts   全局初始化
web/src/index.tsx  启动 React
web/src/app.tsx    应用主体
```

对应 AFFiNE：

```text
web/src/setup.ts
  -> @affine/core/bootstrap/browser
  -> @affine/core/bootstrap/cleanup
  -> @affine/component/theme
```

注意：你现在不要急着实现这些复杂 bootstrap。先把位置留出来。

---

## 第 6 阶段：把通用逻辑放进 @malphite/core

痛点：如果所有组件都放 web 包，未来 electron、mobile、admin 都无法复用。

现在让 `packages/frontend/core` 从空壳变成真正的业务核心包。

建议结构：

```text
packages/frontend/core/
  src/
    index.ts
    components/
      app-shell.tsx
```

`packages/frontend/core/src/components/app-shell.tsx`：

```tsx
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <header>Malphite</header>
      <main>{children}</main>
    </div>
  );
}
```

`packages/frontend/core/src/index.ts`：

```ts
export { AppShell } from "./components/app-shell";
```

然后在 `@mlphite/web` 的 `package.json` 加依赖：

```json
{
  "dependencies": {
    "@malphite/core": "workspace:^"
  }
}
```

并在 `web/src/app.tsx` 使用：

```tsx
import { AppShell } from "@malphite/core";

export function App() {
  return (
    <AppShell>
      <h1>首页</h1>
    </AppShell>
  );
}
```

这一阶段的抽象：

```text
web 包：平台入口
core 包：可复用业务 UI 和逻辑
```

对应 AFFiNE：

```text
@affine/web  很薄
@affine/core 很厚
```

---

## 第 7 阶段：增加最小 router

痛点：App 只有一个页面，无法表达首页、文章页、设置页。

安装：

```bash
pnpm add react-router-dom --filter @mlphite/web
```

先在 web 内实现路由，不要急着抽到 core。

`web/src/router.tsx`：

```tsx
import { createBrowserRouter } from "react-router-dom";

function HomePage() {
  return <h1>首页</h1>;
}

function AboutPage() {
  return <h1>关于</h1>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
]);
```

`web/src/app.tsx`：

```tsx
import { AppShell } from "@malphite/core";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export function App() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  );
}
```

这一阶段只学习：

- Browser router。
- path 到 page 的映射。
- `App` 不再知道具体页面，只接管 router。

对应 AFFiNE：

```text
@affine/core/desktop/router.tsx
  -> topLevelRoutes
  -> RouterProvider
```

---

## 第 8 阶段：把 router 移到 core

痛点：router 也是业务逻辑，未来不应该绑定在 web 包。

移动为：

```text
packages/frontend/core/src/router.tsx
```

`core/src/router.tsx`：

```tsx
import { createBrowserRouter } from "react-router-dom";

function HomePage() {
  return <h1>首页</h1>;
}

function AboutPage() {
  return <h1>关于</h1>;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/about", element: <AboutPage /> },
]);
```

`core/src/index.ts`：

```ts
export { AppShell } from "./components/app-shell";
export { router } from "./router";
```

`web/src/app.tsx`：

```tsx
import { AppShell, router } from "@malphite/core";
import { RouterProvider } from "react-router-dom";

export function App() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  );
}
```

这一阶段后，你的 web 包开始接近 AFFiNE 的形态：

```text
web/src/app.tsx
  -> import router from core
  -> render RouterProvider
```

---

## 第 9 阶段：增加第一个 Service，不要一开始就上 DI

痛点：页面里会出现共享数据，比如站点标题、用户信息、文章列表。

先不用 DI，直接写普通 class。

```text
packages/frontend/core/src/modules/site/site-service.ts
```

```ts
export class SiteService {
  getTitle() {
    return "Malphite";
  }
}

export const siteService = new SiteService();
```

页面里使用：

```tsx
import { siteService } from "../modules/site/site-service";

function HomePage() {
  return <h1>{siteService.getTitle()}</h1>;
}
```

这一阶段只建立一个观念：

```text
组件负责 UI
Service 负责业务数据和动作
```

对应 AFFiNE：

```text
WorkspacesService
WorkspaceService
LifecycleService
GlobalDialogService
```

但你现在不要急着实现 `Framework`。

---

## 第 10 阶段：增加最小状态订阅

痛点：Service 里的数据变化后，React 页面不会自动更新。

先用最简单的订阅模型。

```text
core/src/shared/live-state.ts
```

```ts
type Listener<T> = (value: T) => void;

export class LiveState<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private current: T) {}

  get value() {
    return this.current;
  }

  set(value: T) {
    this.current = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    listener(this.current);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
```

React hook：

```text
core/src/shared/use-live-state.ts
```

```tsx
import { useEffect, useState } from "react";
import type { LiveState } from "./live-state";

export function useLiveState<T>(state: LiveState<T>) {
  const [value, setValue] = useState(state.value);

  useEffect(() => {
    return state.subscribe(setValue);
  }, [state]);

  return value;
}
```

Service：

```ts
import { LiveState } from "../../shared/live-state";

export class SiteService {
  title$ = new LiveState("Malphite");

  rename(title: string) {
    this.title$.set(title);
  }
}

export const siteService = new SiteService();
```

页面：

```tsx
import { siteService } from "../modules/site/site-service";
import { useLiveState } from "../shared/use-live-state";

function HomePage() {
  const title = useLiveState(siteService.title$);

  return (
    <>
      <h1>{title}</h1>
      <button onClick={() => siteService.rename("New Malphite")}>rename</button>
    </>
  );
}
```

对应 AFFiNE：

```text
LiveData
useLiveData
```

你现在的 `LiveState` 是学习版，不需要一开始就引入 RxJS。

---

## 第 11 阶段：实现最小 Framework

痛点：如果所有 service 都手动 import singleton，测试和作用域会越来越难。

先做一个极简容器。

```text
core/src/framework/framework.ts
```

```ts
type Constructor<T> = new (...args: never[]) => T;

export class Framework {
  private instances = new Map<Constructor<unknown>, unknown>();

  service<T>(token: Constructor<T>, instance: T) {
    this.instances.set(token, instance);
    return this;
  }

  get<T>(token: Constructor<T>): T {
    const instance = this.instances.get(token);
    if (!instance) {
      throw new Error(`Service not found: ${token.name}`);
    }
    return instance as T;
  }
}
```

React Provider：

```text
core/src/framework/react.tsx
```

```tsx
import { createContext, useContext, type PropsWithChildren } from "react";
import type { Framework } from "./framework";

const FrameworkContext = createContext<Framework | null>(null);

export function FrameworkRoot({
  framework,
  children,
}: PropsWithChildren<{ framework: Framework }>) {
  return (
    <FrameworkContext.Provider value={framework}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useService<T>(token: new (...args: never[]) => T): T {
  const framework = useContext(FrameworkContext);
  if (!framework) {
    throw new Error("FrameworkRoot is missing");
  }
  return framework.get(token);
}
```

在 `web/src/app.tsx` 创建：

```tsx
import {
  AppShell,
  Framework,
  FrameworkRoot,
  SiteService,
  router,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
framework.service(SiteService, new SiteService());

export function App() {
  return (
    <FrameworkRoot framework={framework}>
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    </FrameworkRoot>
  );
}
```

页面里不再 import singleton：

```tsx
const siteService = useService(SiteService);
```

对应 AFFiNE：

```text
const framework = new Framework();
configureCommonModules(framework);
framework.impl(...);
<FrameworkRoot framework={frameworkProvider}>
```

---

## 第 12 阶段：把注册逻辑抽成 configureModules

痛点：`web/src/app.tsx` 里会塞满 service 注册。

新增：

```text
core/src/modules/index.ts
```

```ts
import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";

export function configureCommonModules(framework: Framework) {
  framework.service(SiteService, new SiteService());
}
```

`web/src/app.tsx`：

```ts
const framework = new Framework();
configureCommonModules(framework);
```

这一步非常重要。

你开始得到 AFFiNE 的核心结构：

```text
App 不知道有哪些业务模块
App 只调用 configureCommonModules
模块自己注册 service
```

对应 AFFiNE：

```text
packages/frontend/core/src/modules/index.ts
```

---

## 第 13 阶段：实现 workspace 的学习版

AFFiNE 的 workspace 很复杂。学习时先把它理解成：

```text
一个 workspace = 一组文章/页面 + 当前上下文 + 独立 service scope
```

先不要上 Yjs、CRDT、IndexedDB、worker。

实现数据：

```text
core/src/modules/workspace/workspace-service.ts
```

```ts
import { LiveState } from "../../shared/live-state";

export type Workspace = {
  id: string;
  name: string;
};

export class WorkspaceService {
  workspaces$ = new LiveState<Workspace[]>([
    { id: "local", name: "Local Workspace" },
  ]);

  current$ = new LiveState<Workspace | null>(null);

  open(id: string) {
    const workspace = this.workspaces$.value.find((item) => item.id === id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }
    this.current$.set(workspace);
  }
}
```

增加路由：

```tsx
{
  path: "/workspace/:workspaceId",
  element: <WorkspacePage />,
}
```

页面逻辑：

```tsx
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useService } from "../framework/react";
import { useLiveState } from "../shared/use-live-state";
import { WorkspaceService } from "../modules/workspace/workspace-service";

function WorkspacePage() {
  const { workspaceId } = useParams();
  const workspaceService = useService(WorkspaceService);
  const current = useLiveState(workspaceService.current$);

  useEffect(() => {
    if (workspaceId) {
      workspaceService.open(workspaceId);
    }
  }, [workspaceId, workspaceService]);

  if (!current) {
    return <div>Loading workspace...</div>;
  }

  return <h1>{current.name}</h1>;
}
```

对应 AFFiNE：

```text
desktop/pages/workspace/index.tsx
  -> useParams()
  -> WorkspacesService.list
  -> workspacesService.open(...)
  -> WorkspacePage
```

---

## 第 14 阶段：实现 workspace 内部路由

痛点：进入 workspace 后，还需要 `/all`、`/:pageId`、`/settings` 这类内部页面。

学习版先不用 AFFiNE 的 Workbench。

可以先做普通嵌套路由：

```text
/workspace/:workspaceId
/workspace/:workspaceId/all
/workspace/:workspaceId/:pageId
/workspace/:workspaceId/settings
```

等普通嵌套路由熟悉后，再理解 AFFiNE 为什么需要 Workbench：

```text
普通应用：一个 URL 对应一个页面
AFFiNE：一个 workspace 里可以有多个 View，每个 View 有自己的 history
```

所以 AFFiNE 多了一层：

```text
WorkspaceLayout
  -> WorkbenchRoot
    -> SplitView
    -> ViewRoot
    -> memory router
```

你的项目先做到普通 workspace router 就够了。

---

## 第 15 阶段：最后再考虑 worker 存储

AFFiNE 的存储链路是：

```text
web app main thread
  -> StoreManagerClient
  -> OpClient
  -> Worker / SharedWorker
  -> StoreManagerConsumer
  -> IndexedDB / cloud / broadcast channel
```

学习时不要一开始做这个。

你可以按三步演进：

### 15.1 内存存储

```ts
const articles = new Map<string, Article>();
```

### 15.2 localStorage 存储

```ts
localStorage.setItem("articles", JSON.stringify([...articles]));
```

### 15.3 IndexedDB 存储

等文章、workspace、router 都稳定后，再封装 IndexedDB。

### 15.4 Worker 存储

只有当主线程压力变大，或者你想学习 AFFiNE 架构时，再把存储挪进 worker。

---

## 你应该如何对照 AFFiNE

不要一上来读所有源码。按这张表读：

| 你的学习阶段 | AFFiNE 文件 |
| --- | --- |
| Web 最小入口 | `packages/frontend/apps/web/src/index.tsx` |
| App 主体 | `packages/frontend/apps/web/src/app.tsx` |
| setup | `packages/frontend/apps/web/src/setup.ts` |
| core 包 | `packages/frontend/core/src` |
| 模块注册 | `packages/frontend/core/src/modules/index.ts` |
| 顶层路由 | `packages/frontend/core/src/desktop/router.tsx` |
| 首页跳 workspace | `packages/frontend/core/src/desktop/pages/index/index.tsx` |
| 打开 workspace | `packages/frontend/core/src/desktop/pages/workspace/index.tsx` |
| workspace 内路由 | `packages/frontend/core/src/desktop/workbench-router.ts` |
| Workbench | `packages/frontend/core/src/modules/workbench/view/workbench-root.tsx` |
| 存储 worker | `packages/frontend/apps/web/src/nbstore.worker.ts` |

每次只读一个文件，问自己三个问题：

1. 这个文件负责什么？
2. 它依赖谁？
3. 如果我不用这个抽象，最简单版本会怎么写？

---

## 推荐实际实现顺序

按这个顺序提交代码，每一步都可以独立运行：

1. `web/src/index.tsx`：最小 DOM 页面。
2. `web/src/app.ts`：抽出 App。
3. `web/src/setup.ts`：预留全局初始化。
4. 接入 React。
5. `core/src/components/app-shell.tsx`：抽公共外壳。
6. `core/src/router.tsx`：抽顶层路由。
7. `core/src/shared/live-state.ts`：实现学习版响应式状态。
8. `core/src/modules/site/site-service.ts`：第一个 service。
9. `core/src/framework/*`：实现学习版 Framework。
10. `core/src/modules/index.ts`：统一注册模块。
11. `core/src/modules/workspace/*`：实现学习版 workspace。
12. `core/src/pages/workspace/*`：实现 workspace 页面。
13. 实现文章列表和文章详情。
14. 把内存数据换成 localStorage。
15. 再考虑 IndexedDB 和 worker。

---

## 当前项目下一步建议

你现在已经实现了：

- monorepo
- CLI
- Vite dev server
- 最小 Web 入口
- 空的 `@malphite/core`

所以下一步不要继续抽 CLI，也不要先做复杂 worker。

最合适的下一步是：

```text
把 @malphite/core 从空包变成可用包：
  src/index.ts
  src/components/app-shell.tsx
```

然后让 `@mlphite/web` 使用 `@malphite/core`。

这一步完成后，你的项目就会从：

```text
web 自己渲染文字
```

变成：

```text
web 负责启动
core 负责应用 UI
```

这就是 AFFiNE 架构的第一层。

---

## 判断是否该抽象的标准

不要因为 AFFiNE 有某个抽象，你就马上实现。

满足下面任一条件再抽：

1. 同类代码出现第二次。
2. 一个文件职责超过两个。
3. 某个逻辑未来需要被 web/electron/mobile 复用。
4. 测试或调试因为耦合变难。
5. 页面逻辑和业务逻辑开始互相污染。

否则先写直白代码。

AFFiNE 的最终形态很复杂，但它背后的演进路线其实是：

```text
能跑
  -> 能复用
  -> 能组合
  -> 能隔离作用域
  -> 能跨平台
  -> 能高性能存储和同步
```

你现在应该处在第一步到第二步之间。
