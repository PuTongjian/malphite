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
| Workbench state | `WorkbenchService.views$` 已有 | `modules/workbench/services/workbench.ts` |

当前缺口：

1. `DocStorageDriver` 还是同步接口，不能自然接 worker。
2. `DocService` 构造函数里同步读取 storage，缺少 loading/error 状态。
3. `WorkbenchService` 只是状态容器，还没有 `WorkbenchRoot`、view router、browser router adapter。
4. workspace 的打开动作散在 `WorkspaceScopeRoot` 里，还没有 AFFiNE 那种 `workspacesService.open(...) -> ref -> dispose()`。
5. web app 入口只注册 common modules，还没有“平台能力 impl/provider”这一层。
6. 路由里还没有 `/workspace/:workspaceId/settings` 页面，旧计划里写了但当前代码未实现。

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

修改或新增 workspace 类型：

```text
packages/frontend/core/src/modules/workspace/workspace-ref.ts
```

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceRef {
  constructor(
    public meta: WorkspaceMeta,
    public provider: FrameworkProvider,
  ) {}

  dispose() {
    this.provider.dispose();
  }
}
```

### 2.2 给 WorkspacesService 增加 open

`WorkspacesService` 现在只管 list。下一步让它也负责打开 workspace。

建议构造函数注入 root provider 太别扭，因为 root provider 本身是运行期对象。更简单的学习版是：

```ts
open(meta, rootProvider) {
  const provider = rootProvider.createChild(...)
  return new WorkspaceRef(meta, provider)
}
```

这不是最终形态，但比把注册逻辑写在 React 组件里更接近 AFFiNE。

目标接口：

```ts
const ref = workspacesService.open(meta, root);
return () => ref.dispose();
```

### 2.3 WorkspaceRoute 只保留 open/dispose

`WorkspaceScopeRoot` 的职责变成：

```text
根据 URL 找 meta
  -> open workspace
  -> FrameworkRoot 使用 ref.provider
  -> unmount dispose ref
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

### 3.2 在 web app 层注册 localStorage driver

`configureCommonModules` 只注册跨平台 service：

```ts
.service(DocStorageService, provider => {
  return new DocStorageService(provider.get(DocStorageProvider));
})
```

`packages/frontend/app/web/src/app.tsx` 注册浏览器实现：

```ts
framework.service(DocStorageProvider, () => {
  return new DocStorageProvider(new LocalDocStorageDriver());
});
```

如果 `LocalDocStorageDriver` 放在 `core` 里感觉怪，先接受它。下一轮再把浏览器 driver 移到 `app/web`。不要一次移动太多。

验收：

1. `DocStorageService` 不再直接 `new LocalDocStorageDriver()`。
2. `configureCommonModules` 不再知道 localStorage。
3. 换 driver 时只改 `app/web/src/app.tsx`。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/apps/web/src/app.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/storage
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

```ts
export interface DocStorageDriver {
  load(workspaceId: string): Promise<Doc[]>;
  save(workspaceId: string, docs: Doc[]): Promise<void>;
}
```

`LocalDocStorageDriver` 也返回 Promise：

```ts
async load(workspaceId: string) {
  const raw = localStorage.getItem(`workspace:${workspaceId}:docs`);
  return raw ? (JSON.parse(raw) as Doc[]) : [];
}

async save(workspaceId: string, docs: Doc[]) {
  localStorage.setItem(`workspace:${workspaceId}:docs`, JSON.stringify(docs));
}
```

### 4.2 DocService 增加 ready/error 状态

不要在构造函数里 `await`。构造函数只创建状态，然后调用 `load()`。

建议状态：

```ts
docs$ = new LiveData<Doc[]>([]);
ready$ = new LiveData(false);
error$ = new LiveData<Error | null>(null);
```

初始化流程：

```ts
constructor(...) {
  void this.load();
}

private async load() {
  try {
    const stored = await this.storage.load(this.workspaceService.id);
    this.docs$.set(stored.length ? stored : [welcomeDoc]);
    this.ready$.set(true);
  } catch (error) {
    this.error$.set(error instanceof Error ? error : new Error(String(error)));
  }
}
```

写入流程：

```ts
private async save(docs: Doc[]) {
  this.docs$.set(docs);
  await this.storage.save(this.workspaceService.id, docs);
}
```

为了保持 UI 简单，`create()` 和 `rename()` 可以先 fire-and-forget：

```ts
void this.save(nextDocs);
```

但要写清楚这是学习版 tradeoff。真正产品要处理保存失败、重试、dirty state。

### 4.3 页面处理 loading/error

`AllDocsPage` 和 `DocPage` 读取：

```ts
const ready = useLiveData(docService.ready$);
const error = useLiveData(docService.error$);
```

最小 UI：

```tsx
if (error) return <div>{error.message}</div>;
if (!ready) return <div>Loading docs...</div>;
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

export type WorkerRequest<
  M extends WorkerDocStorageMethod = WorkerDocStorageMethod,
> = M extends WorkerDocStorageMethod
  ? {
      id: string;
      method: M;
      payload: WorkerDocStorageOps[M]["input"];
    }
  : never;

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
  WorkerRequest,
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
      this.worker.postMessage({ id, method, payload } satisfies WorkerRequest<M>);
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

`app/web/src/app.tsx`：

```ts
const worker = new Worker(new URL("./doc-storage.worker.ts", import.meta.url), {
  type: "module",
});

framework.service(DocStorageProvider, () => {
  return new DocStorageProvider(new WorkerDocStorageDriver(worker));
});
```

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

只暴露：

```ts
loadDocs(workspaceId: string): Promise<Doc[]>
saveDocs(workspaceId: string, docs: Doc[]): Promise<void>
```

然后 worker handler 调用它。

验收：

1. 刷新页面后新建 doc 仍存在。
2. 关闭 tab 再打开仍存在。
3. local/demo 数据不串。
4. DevTools Application -> IndexedDB 能看到 `malphite-doc-storage`。

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

下一步新增：

```text
packages/frontend/core/src/modules/workbench/workbench-root.tsx
```

最小 UI：

```tsx
import { useService } from "~/src/framework/react";
import { WorkbenchService } from "./workbench-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function WorkbenchRoot() {
  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = views.find(view => view.id === activeViewId) ?? views[0];

  if (!activeView) {
    return null;
  }

  return (
    <div>
      <nav>
        {views.map(view => (
          <button
            key={view.id}
            type="button"
            onClick={() => workbench.activeViewId$.set(view.id)}
          >
            {view.path}
          </button>
        ))}
      </nav>
      <WorkbenchView path={activeView.path} />
    </div>
  );
}
```

`WorkbenchView` 先用条件渲染，不要马上接 memory router：

```tsx
function WorkbenchView({ path }: { path: string }) {
  if (path === "/all") return <AllDocsPage />;
  if (path === "/settings") return <WorkspaceSettingsPage />;
  return <DocPageFromWorkbench docId={path.slice(1)} />;
}
```

`DocPageFromWorkbench` 是下一步要从现有 `DocPage` 拆出来的 prop 版组件。现有 `DocPage` 从 `useParams()` 读 `docId`；Workbench 版应该从 props 读 `docId`，这样它不依赖 browser route。

同时把 workspace route 改成只渲染：

```tsx
<WorkbenchRoot />
```

验收：

1. `/workspace/local` 进入 workbench。
2. 默认 view 是 `/all`。
3. 点击 doc 时不是直接 `<Link>` 跳页面，而是 `workbench.open("/docId")`。
4. 打开多个 doc 后，tab 列表能看到多个 view。
5. 关闭 view 不会销毁整个 workspace scope。

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

---

## 8. 给 Workbench 增加 browser router adapter

目标：让浏览器 URL 和 active view 同步。

不要一开始复制 AFFiNE 的完整 adapter。先实现单向同步：

```text
browser URL changes
  -> active view path changes
```

然后再实现反向：

```text
active view path changes
  -> browser URL changes
```

### 8.1 修改 WorkbenchService

先增加：

```ts
activeView$ = this.views$.map(...)

open(path: string, options?: { replace?: boolean }) {
  // 学习版先不做 view history，只更新 active view path
}
```

更好的下一步是把 `View` 从 plain object 升级成类：

```text
packages/frontend/core/src/modules/workbench/view.ts
```

```ts
export class View {
  path$ = new LiveData(this.initialPath);

  constructor(
    public id: string,
    private initialPath: string,
  ) {}
}
```

这样你会自然理解 AFFiNE 的：

```text
View.location$
View.history
View.scope
```

### 8.2 新增 hook

新增：

```text
packages/frontend/core/src/modules/workbench/use-bind-workbench-to-browser-router.ts
```

最小策略：

```text
basename = /workspace/:workspaceId
browser path /workspace/local/welcome
  -> view path /welcome
```

验收：

1. 直接打开 `/workspace/local/welcome`，active view 是 `/welcome`。
2. 在 UI 中打开 `/all`，浏览器 URL 变成 `/workspace/local/all`。
3. 不出现无限 navigate loop。
4. 先不支持 back/forward 的完整 view history，文档里标注限制。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/browser-adapter.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/view-root.tsx
```

理解重点：

```text
browser history 和 view history 是两个栈
同步它们时必须标记变更来源，否则会循环
```

---

## 9. 引入 per-view router 和 view scope

目标：接近 AFFiNE 的 `ViewRoot`，但继续保持小。

当你已经有：

```text
WorkbenchRoot
View
active view
browser adapter
```

再做每个 view 自己的 router。

新增：

```text
packages/frontend/core/src/modules/workbench/view-root.tsx
packages/frontend/core/src/modules/workbench/view-scope.ts
```

### 9.1 ViewScope

```ts
import type { View } from "./view";

export class ViewScope {
  constructor(public view: View) {}
}
```

### 9.2 ViewRoot

先不要用 `UNSAFE_LocationContext`。学习版可以先把 path 传进去，用自己的 route matcher：

```tsx
function ViewRoot({ view }: { view: View }) {
  const path = useLiveData(view.path$);

  if (path === "/all") return <AllDocsPage />;
  if (path === "/settings") return <WorkspaceSettingsPage />;
  return <DocPage docId={path.slice(1)} />;
}
```

等你能解释清楚这个 toy version，再读 AFFiNE 的真实 `ViewRoot`。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/view-root.tsx
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/scopes/view.ts
```

真实版本做的事：

```text
每个 view 有自己的 memory router
每个 view 有自己的 scope
每个 view 可以有自己的 sidebar tabs、scroll position、query string
```

---

## 10. 再读 AFFiNE，不要全仓库乱逛

每次只带一个问题读源码。读完用固定模板写摘要。

模板：

```text
文件：
职责：
依赖：
输出：
它解决的痛点：
当前项目对应 toy version：
下一步是否值得实现：
```

阅读顺序：

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
3. 增加 `DocStorageProvider`，让 web app 提供 localStorage driver。
4. 把 `DocStorageDriver` 改成 async，给 `DocService` 增加 `ready$` / `error$`。
5. 增加 worker RPC 类型和 `WorkerDocStorageDriver`。
6. 新增 `doc-storage.worker.ts`，先用 worker 内存 Map。
7. worker 内部改成 IndexedDB 持久化。
8. 增加 `WorkbenchRoot`，把 `WorkbenchService` 接到 UI。
9. 点击 doc 改为 `workbench.open(...)`，而不是直接依赖 `<Link>`。
10. 增加 browser router adapter，让 URL 和 active view 同步。
11. 把 plain `View` 升级成 class，给每个 view 增加 `path$` 和后续 `scope`。
12. 实现学习版 `ViewRoot`，再对照 AFFiNE 的 memory router 版本。

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
