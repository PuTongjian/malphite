# 从玩具实现到 AFFiNE 思维：Phase 2 C4 教学文档

> 承接上一篇 `docs/web-from-zero-to-affine-style-phase2-teaching-rewrite.md`。
> 这一篇只讲一件事：把已经存在的 C4 能力真正挂到 workspace 生命周期里，并把文档列表、单文档实体、持久化前端之间的边界讲清楚。

## 0. 这一章到底要解决什么

上一篇已经把 `DocStorage`、`DocStore`、`DocFrontend`、`DocsService` 这些拼图介绍出来了，但当时还有一个明显缺口：

1. `SyncEngine` 只是一个类，不算真正接入系统。
2. workspace 打开和关闭时，没有统一的“启动编排”入口。
3. 文档列表和单篇文档各自有状态，读者很容易把它们混在一起。
4. `DocEntity` 和 `DocFrontend` 的职责边界，如果不刻意说明，很容易写歪。

所以这一章的目标不是“做远端同步”，也不是“上 Yjs”，而是先把下面这条主线彻底理顺：

```text
打开 workspace
  -> 创建 workspace scope
  -> 注册 SyncEngine / WorkspaceEngine / DocService / DocsService / WorkbenchService
  -> WorkspaceEngine.start()
  -> SyncEngine.start()
  -> 在 WorkbenchRoot 里显示当前 sync 状态

打开 doc
  -> DocsService.open()
  -> 创建 DocEntity
  -> DocFrontend.connect(doc)
  -> 本地 LiveData 和存储之间双向同步
```

如果你先把这条链跑顺，后面再接 Yjs、远端同步、冲突合并，读起来才不会乱。

## 1. 先记住 5 个关键边界

开始改代码前，先把这 5 个边界记住。后面每一步其实都在落实这几个边界。

### 1.1 root 生命周期 vs workspace 生命周期

`root` 生命周期是“整个应用活着多久，它就活多久”。

`workspace` 生命周期是“某个 workspace 被打开多久，它就活多久”。

所以：

- `SiteService`、`WorkspacesService` 这种全局能力，放 root。
- `SyncEngine`、`WorkspaceEngine`、`WorkspaceService` 这种只对当前 workspace 生效的能力，放 workspace scope。

这就是为什么 `SyncEngine` 不能注册在 root common modules 里，而要注册在 workspace scope 里。

### 1.2 list meta vs doc body

文档列表里的数据，和单篇文档正文的数据，不是一回事。

最简单的理解方式：

- list meta：列表视角的快照字段，例如 `id`、`title`，主要给列表页和导航用。
- doc body：单篇文档编辑态的数据，例如 `title$`、`content$`。

注意，`title` 在两层都会出现：列表里的是展示快照，`DocEntity` 里的是当前编辑态。这个 toy 项目为了让 All Docs 立即更新，会在标题输入时同时改这两层；真正持久化仍由已连接的 `DocFrontend` 接管。

在这个 toy 项目里：

- `DocService.docs$` 管列表。
- `DocEntity` 管单篇文档的内存状态。
- `DocFrontend` 管单篇文档和存储的同步。

所以 `DocsService.open()` 只能用列表 record 给 `DocEntity` seed `title$`，不要顺手把旧 `content` 也灌进去。正文的初次值应由存储层加载决定；但如果某个字段在初次加载完成前已经被本地改动，就保留本地值，不再用存储结果覆盖。

### 1.3 DocEntity vs DocFrontend

`DocEntity` 只表示“内存里的文档对象”。

它应该只保留：

- `LiveData`
- 简单 getter
- 简单修改方法

它不应该直接持久化。

真正的持久化桥接，是 `DocFrontend` 的职责。也就是：

- `DocEntity.rename()` 只是改 `title$`
- `DocEntity.setContent()` 只是改 `content$`
- 写入存储、订阅存储变化、处理回声和 race，交给 `DocFrontend.connect()`

### 1.4 C4 先做启动编排，不急着上 Yjs

这一步很多人会着急：“既然 AFFiNE 用 Yjs，为什么不直接上？”

原因很简单：现在先补的是系统边界，不是协同算法。

如果你连下面这些都还没稳住：

- 谁负责启动 sync
- 谁负责停止 sync
- sync 状态显示在哪
- doc 列表和 doc 正文边界是什么
- 本地初次加载 race 怎么处理

那你把 Yjs 加进来，只会让问题更难看清。

所以 C4 的重点是：先把启动编排和生命周期挂好。Yjs 是下一层。

重要限制：当前实现仍然是本地快照级别的 last-write-wins。同一篇文档的并发修改没有 Yjs 那样的 CRDT 合并能力，也没有冲突解决、awareness、state vector 等机制。第 8 节处理的只是“本地初次加载与本地输入”的竞态，不是多端协同冲突解决。

### 1.5 为什么 `SyncStatus` 放在 `WorkbenchRoot`，不是 `AppShell`

因为 `AppShell` 在 root provider 下，它不天然属于某个 workspace。

而 `SyncEngine` 是 workspace-scoped service。

所以状态展示要放在 workspace UI 内，也就是 `WorkbenchRoot`，不能放在 root 级 `AppShell`。

## 2. 这章完成后的目标状态

改完之后，你应该看到的是：

1. `WorkspaceEngine.start()` 先真正 `sync.start()`，成功后才记 `started = true`。
2. `WorkspacesService.open()` 如果 engine 启动失败，会 `provider.dispose(); throw error;`，不会泄露半开状态。
3. `SyncEngine` 注册在 workspace scope，不在 root common modules。
4. `SyncStatus` 显示在 `WorkbenchRoot`。
5. `DocStore.setDocList()` 和 `DocService.create()` 创建新文档时，不会重写所有已有文档内容。
6. `DocService.rename()` 只更新列表 `LiveData`，持久化还是由 `DocFrontend` 负责。
7. `DocsService.open()` 只从列表 record seed `title$`，不 seed `content`。
8. `DocFrontend.connect()` 正确处理 initial-load race：
   - 初次加载完成前不 push
   - 本地预加载改动按字段保留
   - 加载完成后如果 dirty，再 flush 一次
9. `DocEntity` 不直接写存储，只保留最轻的内存模型。

下面开始按文件落地。

## 3. 第一步：补上 workspace engine

这一节解决的问题是：`SyncEngine` 虽然有类，但没有被一个明确的 workspace 生命周期对象托管。

### 要改哪个文件

创建新文件：

- `packages/frontend/core/src/modules/workspace/workspace-engine.ts`

### 完整代码

把文件内容写成下面这样：

```ts
import type { SyncEngine } from "~/src/modules/storage/sync-engine";

export class WorkspaceEngine {
  private started = false;

  constructor(private sync: SyncEngine) {}

  start() {
    if (this.started) {
      return;
    }

    this.sync.start();
    this.started = true;
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.sync.stop();
  }

  dispose() {
    this.stop();
  }
}
```

### 为什么这么改

这里最重要的是 `start()` 的顺序：

```ts
this.sync.start();
this.started = true;
```

不能反过来写成：

```ts
this.started = true;
this.sync.start();
```

原因很直接：

如果 `sync.start()` 抛错，而你提前把 `started` 标成了 `true`，这个 engine 就会误以为自己已经启动成功。后续再试图重启或清理，就会进入错误状态。

所以正确顺序一定是：

1. 先调用 `sync.start()`
2. 成功之后再把 `started = true`

### 如何检查

先至少做一次类型检查：

```bash
rtk pnpm typecheck
```

只要没有类型错误，这一步就算过。

## 4. 第二步：把 `SyncEngine` 挂到 workspace scope，而不是 root

这一节解决的问题是：`SyncEngine` 应该跟着 workspace 生灭，而不是跟着整个应用生灭。

### 要改哪个文件

- `packages/frontend/core/src/modules/workspace/index.ts`
- `packages/frontend/core/src/modules/index.ts`
- `packages/frontend/core/src/modules/storage/index.ts`

### 4.1 替换 `packages/frontend/core/src/modules/workspace/index.ts`

完整替换成：

```ts
import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "~/src/modules/storage/doc-storage";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { WorkspaceEngine } from "./workspace-engine";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export function configureWorkspaceScopeModule(framework: Framework) {
  framework
    .service(WorkspaceService, (provider) => {
      return new WorkspaceService(provider.get(WorkspaceScope));
    })
    .service(SyncEngine, (provider) => {
      return new SyncEngine(provider.get(DocStorageHandle).storage);
    })
    .service(WorkspaceEngine, (provider) => {
      return new WorkspaceEngine(provider.get(SyncEngine));
    });
}
```

### 为什么这么改

这段代码的意思是：

1. 当前 workspace child provider 创建时，顺手注册 `WorkspaceService`
2. 同一个 workspace scope 内，再注册 `SyncEngine`
3. 最后再注册 `WorkspaceEngine`

这样 `SyncEngine` 就不是 root 共享单例，而是“每个打开的 workspace 拥有自己的实例”。

### 如何检查

你可以肉眼确认：`SyncEngine` 的构造是通过 `provider.get(DocStorageHandle).storage` 拿到存储；而这个 service 注册点已经在 workspace module 内，不在 root common module 内。

### 4.2 替换 `packages/frontend/core/src/modules/index.ts`

完整替换成：

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

### 为什么这么改

这里的重点不是“多写了几行”，而是“少注册了不该在 root 的东西”。

root common modules 现在只保留：

- `SiteService`
- `WorkspacesService`
- root 级文档存储模块

没有在这里注册 `SyncEngine`，这才符合 workspace 生命周期边界。

### 如何检查

肉眼看这份文件时，只要没有 root 级 `SyncEngine` 注册，就对了。

### 4.3 替换 `packages/frontend/core/src/modules/storage/index.ts`

完整替换成：

```ts
import type { Framework } from "~/src/framework/framework";
import { DocStorageProvider } from "./doc-storage-provider";
import type { DocStorageDriver } from "./doc-storage-service";
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

### 为什么这么改

这一步是为了把 storage 模块收回到“只负责 storage 本身”。

也就是说：

- storage 模块只处理 `DocStorageService` / `DocStorageProvider`
- `SyncEngine` 不再从这里兜出来注册

这样之后，模块边界会清楚很多：

- root：全局入口
- workspace：workspace 生命周期对象与 sync
- doc：单文档对象

### 如何检查

看这份文件时，确认没有 `configureSyncEngineModule()` 之类的 root 级 sync 注册入口。

## 5. 第三步：打开 workspace 时真正启动 engine，失败时清理 provider

这一节解决的问题是：即使你把 `WorkspaceEngine` 注册进 DI，如果没有实际 `start()`，它仍然只是摆设。

### 要改哪个文件

- `packages/frontend/core/src/modules/workspace/workspaces-service.ts`
- `packages/frontend/core/src/modules/workspace/workspace-ref.ts`

### 5.1 替换 `packages/frontend/core/src/modules/workspace/workspaces-service.ts`

完整替换成：

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { configureDocModule } from "~/src/modules/doc";
import { configureWorkbenchModule } from "~/src/modules/workbench";
import { LiveData } from "~/src/shared/live-data";
import { configureWorkspaceScopeModule } from "./index";
import { WorkspaceEngine } from "./workspace-engine";
import { WorkspaceRef } from "./workspace-ref";
import { WorkspaceScope } from "./workspace-scope";

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
    return this.workspaces$.value.find((workspace) => {
      return workspace.id === id;
    });
  }

  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      framework.service(WorkspaceScope, () => new WorkspaceScope(meta));

      configureWorkspaceScopeModule(framework);
      configureDocModule(framework);
      configureWorkbenchModule(framework);
    });

    try {
      const engine = provider.get(WorkspaceEngine);
      engine.start();

      return new WorkspaceRef(meta, provider, engine);
    } catch (error) {
      provider.dispose();
      throw error;
    }
  }
}
```

### 为什么这么改

这里有两个关键点。

第一个关键点：真正启动 engine。

```ts
const engine = provider.get(WorkspaceEngine);
engine.start();
```

如果没有这两行，你前面注册的 `WorkspaceEngine` 和 `SyncEngine` 依然不会参与真实行为。

第二个关键点：启动失败时要清理 provider。

```ts
} catch (error) {
  provider.dispose();
  throw error;
}
```

这个细节非常重要。因为 child provider 里已经创建了一整套 workspace-scope 对象：

- `WorkspaceService`
- `SyncEngine`
- `WorkspaceEngine`
- `DocService`
- `DocsService`
- `WorkbenchService`

如果 `engine.start()` 失败，但你不 `dispose()`，这些对象就会留下半初始化状态，后面非常难排查。

所以这里必须是：

1. `provider.get(WorkspaceEngine)`
2. `engine.start()`
3. 失败就 `provider.dispose(); throw error;`

### 如何检查

肉眼检查 `open()` 是否满足下面这个模式：

```ts
try {
  const engine = provider.get(WorkspaceEngine);
  engine.start();
  return new WorkspaceRef(meta, provider, engine);
} catch (error) {
  provider.dispose();
  throw error;
}
```

### 5.2 替换 `packages/frontend/core/src/modules/workspace/workspace-ref.ts`

完整替换成：

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import type { WorkspaceEngine } from "./workspace-engine";
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceRef {
  constructor(
    public meta: WorkspaceMeta,
    public provider: FrameworkProvider,
    private engine: WorkspaceEngine,
  ) {}

  dispose() {
    this.engine.stop();
    this.provider.dispose();
  }
}
```

### 为什么这么改

`WorkspaceRef` 是“打开中的 workspace 句柄”。

既然 `open()` 里启动了 engine，那么关闭 workspace 时也应该先停 engine，再销毁 provider。

关闭顺序写成：

1. `this.engine.stop()`
2. `this.provider.dispose()`

这会比“直接销毁 provider”更清晰，因为生命周期控制点集中在 `WorkspaceRef` 上。

### 如何检查

确认 `dispose()` 里不是只写 `provider.dispose()`，而是先停 engine。

## 6. 第四步：把 sync 状态显示放到 `WorkbenchRoot`，不要放 `AppShell`

这一节解决的问题是：sync 状态属于 workspace UI，而不是根壳子。

### 要改哪个文件

- `packages/frontend/core/src/components/app-shell.tsx`
- `packages/frontend/core/src/modules/workbench/workbench-root.tsx`

### 6.1 替换 `packages/frontend/core/src/components/app-shell.tsx`

完整替换成：

```ts
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <header>Malphite header</header>
      <main>{children}</main>
    </div>
  );
}
```

### 为什么这么改

`AppShell` 现在只保留 root 级外壳。

它不再关心 sync 状态，因为它根本不应该默认拿到 workspace-scoped 的 `SyncEngine`。

### 如何检查

确认这里没有 `useService(SyncEngine)`，也没有 `SyncStatus`。

### 6.2 替换 `packages/frontend/core/src/modules/workbench/workbench-root.tsx`

完整替换成：

```ts
import { useService } from "~/src/framework/react";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { useLiveData } from "~/src/shared/use-live-data";
import { useBindWorkbenchToBrowserRouter } from "./use-bind-workbench-to-browser-router";
import { ViewRoot } from "./view-root";
import { WorkbenchService } from "./workbench-service";

function SyncStatus() {
  const sync = useService(SyncEngine);
  const state = useLiveData(sync.state$);
  const error = useLiveData(sync.error$);

  if (error) {
    return <span>Sync: error</span>;
  }

  return <span>Sync: {state}</span>;
}

export function WorkbenchRoot() {
  useBindWorkbenchToBrowserRouter();

  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];

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

        <SyncStatus />
      </header>

      <ViewRoot view={activeView} />
    </section>
  );
}
```

### 为什么这么改

原因只有一句话：`WorkbenchRoot` 本来就跑在 workspace scope 里，所以它拿 `SyncEngine` 是合理的。

这样做的好处是：

1. 状态展示位置正确
2. 以后如果每个 workspace 有不同 sync 状态，这里天然支持
3. 不会把 workspace 依赖偷偷扩散到 root `AppShell`

### 如何检查

运行页面后，打开 workspace，你应该能在 workbench header 看到：

- 当前 toy 实现的稳定状态是 `Sync: synced`
- 只有启动瞬间或以后扩展状态机时，才可能短暂出现其他状态

如果以后 `SyncEngine.error$` 有值，就显示 `Sync: error`。

## 7. 第五步：修正文档列表和单篇文档的职责分工

这一节最容易写错。因为很多初学者会下意识把“列表更新”和“正文持久化”混成一个动作。

你要强行记住：

- 列表更新：`DocService`
- 单篇文档内存状态：`DocEntity`
- 单篇文档持久化：`DocFrontend`

### 要改哪个文件

- `packages/frontend/core/src/modules/doc/doc-store.ts`
- `packages/frontend/core/src/modules/doc/doc-service.ts`
- `packages/frontend/core/src/modules/doc/docs-service.ts`
- `packages/frontend/core/src/pages/workspace/doc-page.tsx`

### 7.1 替换 `packages/frontend/core/src/modules/doc/doc-store.ts`

完整替换成：

```ts
import type {
  DocRecordData,
  DocStorage,
} from "~/src/modules/storage/doc-storage";
import type { Doc } from "./doc-types";

export class DocStore {
  constructor(
    private storage: DocStorage,
    private workspaceId: string,
  ) {}

  async getDoc(docId: string) {
    return this.storage.getDoc(docId);
  }

  async pushDocUpdate(docId: string, data: DocRecordData) {
    await this.storage.pushDocUpdate(docId, data);
  }
  subscribeDocUpdate(callback: (docId: string) => void) {
    return this.storage.subscribeDocUpdate(callback);
  }

  async listDocIds() {
    return this.storage.getDocList(this.workspaceId);
  }

  async load(workspaceId: string): Promise<Doc[]> {
    const ids = await this.storage.getDocList(workspaceId);
    const docs: Doc[] = [];

    for (const id of ids) {
      const record = await this.storage.getDoc(id);
      if (record) {
        docs.push({
          id: record.docId,
          title: record.data.title,
          content: record.data.content,
        });
      }
    }

    return docs;
  }

  async save(workspaceId: string, docs: Doc[]): Promise<void> {
    for (const doc of docs) {
      await this.storage.pushDocUpdate(doc.id, {
        title: doc.title,
        content: doc.content,
      });
    }

    await this.storage.setDocList(
      workspaceId,
      docs.map((doc) => doc.id),
    );
  }

  async setDocList(workspaceId: string, docs: Doc[]): Promise<void> {
    await this.storage.setDocList(
      workspaceId,
      docs.map((doc) => doc.id),
    );
  }
}
```

### 为什么这么改

重点看最后这个方法：

```ts
async setDocList(workspaceId: string, docs: Doc[]): Promise<void> {
  await this.storage.setDocList(
    workspaceId,
    docs.map((doc) => doc.id),
  );
}
```

这里故意只写 doc id 列表，不去重写每篇文档内容。

这是为了保证：

- 新建文档时，只增加列表项
- 不会顺便把已有文档的旧内容重新覆盖一遍

也就是说，`DocStore.setDocList()` 处理的是 list meta，不是 doc body。

### 如何检查

肉眼确认 `setDocList()` 只调用 `storage.setDocList()`，没有循环 `pushDocUpdate()`。

### 7.2 替换 `packages/frontend/core/src/modules/doc/doc-service.ts`

完整替换成：

```ts
import type { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { LiveData } from "~/src/shared/live-data";
import type { DocStore } from "./doc-store";
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
  error$ = new LiveData<Error | null>(null);
  ready$ = new LiveData(false);

  constructor(
    private workspaceService: WorkspaceService,
    private storage: DocStore,
  ) {
    void this.load();
  }

  create(title: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title,
      content: "",
    };

    const nextDocs = [...this.docs$.value, doc];
    this.docs$.set(nextDocs);
    this.error$.set(null);

    void this.createInStorage(doc, nextDocs);

    return doc;
  }

  rename(id: string, title: string) {
    const existing = this.docs$.value.find((doc) => doc.id === id);

    const nextDocs = existing
      ? this.docs$.value.map((doc) => {
          return doc.id === id ? { ...doc, title } : doc;
        })
      : [
          ...this.docs$.value,
          {
            id,
            title,
            content: "",
          },
        ];

    this.docs$.set(nextDocs);
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

  private async createInStorage(doc: Doc, docs: Doc[]) {
    try {
      await this.storage.pushDocUpdate(doc.id, {
        title: doc.title,
        content: doc.content,
      });
      await this.storage.setDocList(this.workspaceService.id, docs);
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

### 为什么这么改

这里有两个必须注意的点。

#### 点 1：`create()` 新建文档时，不要重写所有已有文档内容

新建后走的是：

```ts
await this.storage.pushDocUpdate(doc.id, {
  title: doc.title,
  content: doc.content,
});
await this.storage.setDocList(this.workspaceService.id, docs);
```

也就是说：

1. 只给新文档写一次内容记录
2. 再更新列表 id

而不是把整个 `docs[]` 全量 `save()` 一遍。

这样可以避免“新建一个空白 doc，顺手把其它 doc 的旧内容重新刷回存储”的问题。

#### 点 2：`rename()` 只更新列表 `LiveData`

这一句非常重要：

`DocService.rename()` 在本章语境里只改 `docs$`，不直接持久化。

为什么？

因为这里的重命名发生在文档页内：当前文档已经打开，并且已经由 `DocFrontend.connect()` 接管。真正正在编辑的那篇文档，会由 `DocFrontend` 订阅 `DocEntity.title$` 去持久化。

如果 `DocService.rename()` 也顺手去写 storage，就会让“列表层”和“文档前端层”同时尝试持久化，职责会打架。

所以当前实现里：

- `DocService.rename()` 负责让列表 UI 及时更新
- 已打开文档的持久化交给 `DocFrontend`

这个规则有一个前提：重命名发生在当前已打开、且已经由 `DocFrontend.connect()` 接管的文档页中。如果以后支持“在列表页直接重命名未打开文档”，就需要补一条独立的持久化路径，不能继续只改 `docs$`。

### 如何检查

1. 看 `create()` 是否调用了 `createInStorage(doc, nextDocs)`，而不是全量 `save(nextDocs)`。
2. 看 `rename()` 是否只有 `this.docs$.set(nextDocs)`，没有 `pushDocUpdate()`。

### 7.3 替换 `packages/frontend/core/src/modules/doc/docs-service.ts`

完整替换成：

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { ObjectPool, type PoolHandle } from "~/src/shared/object-pool";
import { DocEntity } from "./doc-entity";
import type { DocFrontend } from "./doc-frontend";
import { DocScope } from "./doc-scope";
import type { DocService } from "./doc-service";
import { DocStore } from "./doc-store";

export type DocOpenHandle = PoolHandle<{
  doc: DocEntity;
  provider: FrameworkProvider;
  dispose: () => void;
}>;

export class DocsService {
  private pool = new ObjectPool<{ dispose(): void }>();

  constructor(
    private provider: FrameworkProvider,
    private listService: DocService,
    private docFrontend: DocFrontend,
  ) {}

  get docs$() {
    return this.listService.docs$;
  }

  get ready$() {
    return this.listService.ready$;
  }

  get error$() {
    return this.listService.error$;
  }

  create(title: string) {
    return this.listService.create(title);
  }

  rename(id: string, title: string) {
    this.listService.rename(id, title);
  }

  open(docId: string): DocOpenHandle {
    const existing = this.pool.get(docId);

    if (existing) {
      const handle = existing.obj as DocOpenHandle["obj"];
      return {
        obj: handle,
        release: existing.release,
      };
    }

    const docProvider = this.provider.createChild((framework) => {
      framework
        .service(DocScope, () => new DocScope(docId))
        .entity(DocEntity, (_provider) => {
          return new DocEntity(
            _provider.get(DocScope),
            _provider.get(DocStore),
          );
        });
    });

    const record = this.listService.get(docId);
    const docEntity = docProvider.createEntity(DocEntity, undefined as never);

    if (record) {
      docEntity.title$.set(record.title);
    }

    const disconnect = this.docFrontend.connect(docEntity);

    const handle = {
      doc: docEntity,
      provider: docProvider,
      dispose: () => {
        disconnect();
        docProvider.dispose();
      },
    };

    const pooled = this.pool.put(docId, handle);
    return { obj: handle, release: pooled.release };
  }
}
```

### 为什么这么改

这里最关键的一句是：

```ts
if (record) {
  docEntity.title$.set(record.title);
}
```

只 seed `title$`，不 seed `content$`。

为什么？

因为列表记录只是列表层的 meta 来源，它能保证“列表页看到的标题”和“刚打开时标题框里有值”。

但正文内容应该交给：

```ts
this.docFrontend.connect(docEntity)
```

去从存储里初次读取。

如果你在这里把旧 `content` 也提前塞进去，等 `DocFrontend` 初次加载回来时，就会把“列表里可能已经过期的正文值”和“存储里真正的正文值”混在一起，race 更乱。

### 如何检查

确认 `open()` 里只写了：

```ts
docEntity.title$.set(record.title);
```

没有：

```ts
docEntity.content$.set(record.content);
```

也不要写成：

```ts
docEntity.content$.set(record.data.content);
```

### 7.4 替换 `packages/frontend/core/src/pages/workspace/doc-page.tsx`

完整替换成：

```ts
import { useService } from "~/src/framework/react";
import { DocsService } from "~/src/modules/doc/docs-service";
import { useDocScope } from "~/src/modules/doc/use-doc-scope";
import { useLiveData } from "~/src/shared/use-live-data";

type DocPageContentProps = {
  docId: string | undefined;
};

export function DocPageContent({ docId }: DocPageContentProps) {
  const docsService = useService(DocsService);
  const ready = useLiveData(docsService.ready$);
  const error = useLiveData(docsService.error$);
  const docHandle = useDocScope(docId);

  if (error) return <div>{error.message}</div>;
  if (!ready) return <div>Loading docs...</div>;
  if (!docHandle || !docId) return <div>Doc not found</div>;

  const doc = docHandle.obj.doc;

  return <DocPageEditor doc={doc} docsService={docsService} />;
}

function DocPageEditor({
  doc,
  docsService,
}: {
  doc: NonNullable<ReturnType<typeof useDocScope>>["obj"]["doc"];
  docsService: DocsService;
}) {
  const title = useLiveData(doc.title$);
  const content = useLiveData(doc.content$);

  return (
    <article>
      <input
        value={title}
        onChange={(event) => {
          const nextTitle = event.target.value;
          doc.rename(nextTitle);
          docsService.rename(doc.id, nextTitle);
        }}
      />
      <textarea
        value={content}
        onChange={(event) => doc.setContent(event.target.value)}
      />
    </article>
  );
}
```

### 为什么这么改

标题输入时要同时做两件事：

```ts
doc.rename(nextTitle);
docsService.rename(doc.id, nextTitle);
```

第一件事 `doc.rename(nextTitle)`：

- 更新当前打开文档的 `title$`
- 让 `DocFrontend` 感知到变化并持久化

第二件事 `docsService.rename(doc.id, nextTitle)`：

- 更新列表层 `docs$`
- 让 All Docs 页面马上看到新标题

这两件事不是重复，而是分属两层：

- `DocEntity` / `DocFrontend`：单篇文档编辑链路
- `DocService`：列表展示链路

正文输入则只需要：

```ts
doc.setContent(event.target.value)
```

因为正文不需要通过列表层同步。

### 如何检查

1. 改标题时，当前页 input 立即更新。
2. 返回 All Docs，标题也立即更新。
3. 刷新后标题仍保留，说明持久化链路也通了。

## 8. 第六步：把 `DocFrontend` 的 initial-load race 讲清楚

这一节是整章里最容易被低估、但实际上最关键的部分。

很多人第一次写“本地 LiveData 和存储同步”时，都会踩到这个坑：

1. 页面一打开，先创建了 `DocEntity`
2. 用户很快开始输入
3. 存储层的 `getDoc()` 结果稍后才回来
4. 结果初次加载把用户刚输入的内容覆盖掉了

所以当前实现必须处理这件事。

### 要改哪个文件

- `packages/frontend/core/src/modules/doc/doc-frontend.ts`

### 完整代码

完整替换成：

```ts
import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    let applyingRemote = false;
    let initialLoadComplete = false;
    let titleChangedBeforeInitialLoad = false;
    let contentChangedBeforeInitialLoad = false;

    const applyRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      doc.title$.set(record.data.title);
      doc.content$.set(record.data.content);
      applyingRemote = false;
    };

    const applyInitialRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      if (!titleChangedBeforeInitialLoad) {
        doc.title$.set(record.data.title);
      }
      if (!contentChangedBeforeInitialLoad) {
        doc.content$.set(record.data.content);
      }
      applyingRemote = false;
    };

    const applyStorageRecord = (record: {
      data: { title: string; content: string };
    }) => {
      if (initialLoadComplete) {
        applyRecord(record);
      } else {
        applyInitialRecord(record);
      }
    };

    void this.storage
      .getDoc(doc.id)
      .then((record) => {
        if (record) applyStorageRecord(record);
      })
      .finally(() => {
        initialLoadComplete = true;
        if (dirty) {
          dirty = false;
          push();
        }
      });

    const unsubscribeRemote = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((record) => {
        if (record) applyStorageRecord(record);
      });
    });

    let pushing = false;
    let dirty = false;

    const push = () => {
      if (applyingRemote) return;
      if (!initialLoadComplete) {
        dirty = true;
        return;
      }
      if (pushing) {
        dirty = true;
        return;
      }

      pushing = true;
      void this.storage
        .pushDocUpdate(doc.id, {
          title: doc.title$.value,
          content: doc.content$.value,
        })
        .finally(() => {
          pushing = false;
          if (dirty) {
            dirty = false;
            push();
          }
        });
    };

    const markLocalChange = (field: "title" | "content") => {
      if (applyingRemote) return;
      if (!initialLoadComplete) {
        if (field === "title") {
          titleChangedBeforeInitialLoad = true;
        } else {
          contentChangedBeforeInitialLoad = true;
        }
        dirty = true;
        return;
      }
      push();
    };

    const stopTitle = doc.title$.subscribe(() => markLocalChange("title"));
    const stopContent = doc.content$.subscribe(() =>
      markLocalChange("content"),
    );

    return () => {
      unsubscribeRemote();
      stopTitle();
      stopContent();
    };
  }
}
```

### 为什么这么改

把这一段拆开理解。

#### 8.1 初次加载完成前，不要 push

看这里：

```ts
if (!initialLoadComplete) {
  dirty = true;
  return;
}
```

这表示：

- 如果存储里的初次 `getDoc()` 还没回来
- 本地先发生了编辑

那么先记一笔 `dirty`，但不要立刻写回存储。

这样做的目的是避免“本地空值”先把存储里的真实值覆盖掉。

#### 8.2 本地预加载改动要按字段保留

看这里：

```ts
if (!titleChangedBeforeInitialLoad) {
  doc.title$.set(record.data.title);
}
if (!contentChangedBeforeInitialLoad) {
  doc.content$.set(record.data.content);
}
```

这段解决的是：

- 如果用户在初次加载完成前改过标题，那初次加载回来时，不要拿旧标题覆盖它。
- 如果用户在初次加载完成前改过正文，那初次加载回来时，不要拿旧正文覆盖它。

而且是按字段分开判断的。

这点非常关键。因为真实情况可能是：

- 用户只改了标题，没改正文

那就应该：

- 保留本地标题
- 仍然接受存储里的正文

不能粗暴地“一旦本地有改动，就整篇都不加载”。

#### 8.3 初次加载完成后，如果 dirty，就 flush 一次

看这里：

```ts
.finally(() => {
  initialLoadComplete = true;
  if (dirty) {
    dirty = false;
    push();
  }
});
```

意思是：

1. 初次加载阶段结束了
2. 如果期间本地已经改过内容
3. 那就补做一次真正 push

这样才能把“加载前的本地输入”最后同步到存储。

#### 8.4 `DocFrontend` 负责持久化，`DocEntity` 不负责

注意整份文件都在做：

- 订阅 `doc.title$`
- 订阅 `doc.content$`
- 从存储读
- 往存储写

这正是持久化前端层该做的事。

也正因为如此，`DocEntity` 自己就应该保持非常轻。

### 如何检查

你可以用下面的人工心智测试判断逻辑对不对：

1. 假设存储里已有 `{ title: "A", content: "B" }`
2. 页面刚打开，`getDoc()` 还没返回
3. 用户先把标题改成 `"A2"`
4. 然后 `getDoc()` 返回

正确结果应该是：

- 标题保留 `"A2"`
- 正文仍然从存储拿到 `"B"`
- 初次加载结束后，再补一次 push

这正是这版实现的行为。

## 9. 第七步：让 `DocEntity` 退回最小职责

这一节是为了把边界收口。

### 要改哪个文件

- `packages/frontend/core/src/modules/doc/doc-entity.ts`

### 完整代码

完整替换成：

```ts
import { LiveData } from "~/src/shared/live-data";
import type { DocScope } from "./doc-scope";
import type { DocStore } from "./doc-store";

export class DocEntity {
  title$ = new LiveData("");
  content$ = new LiveData("");

  constructor(
    public readonly scope: DocScope,
    _store: DocStore,
  ) {}

  get id() {
    return this.scope.docId;
  }

  rename(title: string) {
    this.title$.set(title);
  }

  setContent(content: string) {
    this.content$.set(content);
  }
}
```

### 为什么这么改

现在的 `DocEntity` 就做三件事：

1. 持有 `title$`
2. 持有 `content$`
3. 提供简单修改方法

它不直接持久化，也不直接订阅存储。

这就是这一章要强调的边界：

- `DocEntity`：内存模型
- `DocFrontend`：同步桥
- `DocStore` / `DocStorage`：存储接口

### 如何检查

确认 `DocEntity` 里没有：

- `pushDocUpdate()`
- `getDoc()`
- `subscribeDocUpdate()`

这种直接接触存储的行为。

## 10. 整体复盘：这章到底完成了什么

到这里，你其实完成了三件很重要的基础设施工作。

### 10.1 把 C4 从“只有类定义”变成“真实系统行为”

现在不是只有 `SyncEngine` 类存在，而是：

- 会在 workspace 打开时启动
- 会在 workspace 关闭时停止
- 会在 workspace UI 内显示状态

这才叫接入系统。

### 10.2 把生命周期边界拉直了

现在的分层可以这么记：

```text
root
  -> SiteService
  -> WorkspacesService

workspace scope
  -> WorkspaceService
  -> SyncEngine
  -> WorkspaceEngine
  -> DocService
  -> DocsService
  -> WorkbenchService

doc scope
  -> DocEntity
```

这比“所有 service 都挂在 root，然后谁都能随便拿”清楚得多。

### 10.3 把列表 meta 和 doc body 拆开了

现在：

- `DocService.docs$` 负责列表层
- `DocEntity` 负责单文档实时状态
- `DocFrontend` 负责持久化

这条边界一旦清楚，后面接 Yjs 才不会一团糟。

## 11. 验收清单 / 运行命令

这一节不要跳过。你至少要跑这些命令。

### 11.1 类型检查

```bash
rtk pnpm typecheck
```

通过标准：

- TypeScript 构建通过
- 没有新增类型错误

### 11.2 跑 `DocFrontend` 的 race 复现脚本

这一步是为了确认 initial-load race 逻辑没有回退。

前提：当前工作目录是仓库根目录，并且仓库内已经可以运行 `pnpm exec tsx`。

先创建临时测试目录：

```bash
rtk proxy mkdir -p /private/tmp/malphite-tests
```

然后把下面完整代码保存为 `/private/tmp/malphite-tests/doc-frontend-race-test.ts`。

```ts
import { DocFrontend } from "/Users/malphite/Desktop/Archive/code/石头人的博客/malphite/packages/frontend/core/src/modules/doc/doc-frontend.ts";
import { DocEntity } from "/Users/malphite/Desktop/Archive/code/石头人的博客/malphite/packages/frontend/core/src/modules/doc/doc-entity.ts";

type DocRecordData = {
  title: string;
  content: string;
};

type DocRecord = {
  docId: string;
  data: DocRecordData;
  timestamp: number;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

async function main() {
  const initialLoad = deferred<DocRecord | null>();
  const pushes: Array<{ docId: string; data: DocRecordData }> = [];
  let subscriber: ((docId: string) => void) | null = null;

  const storage = {
    getDoc() {
      return initialLoad.promise;
    },
    async pushDocUpdate(docId: string, data: DocRecordData) {
      pushes.push({ docId, data });
    },
    async getDocList() {
      return [];
    },
    async setDocList() {},
    subscribeDocUpdate(callback: (docId: string) => void) {
      subscriber = callback;
      return () => {
        subscriber = null;
      };
    },
  };

  const doc = new DocEntity({ docId: "doc-1" }, {} as never);
  doc.title$.set("List Title");

  const frontend = new DocFrontend(storage);
  const disconnect = frontend.connect(doc);

  doc.rename("Edited Before Load");
  await Promise.resolve();
  await Promise.resolve();

  if (pushes.length > 0) {
    throw new Error(
      `Expected no push before initial load, got ${JSON.stringify(pushes)}`,
    );
  }

  subscriber?.("doc-1");
  await Promise.resolve();
  await Promise.resolve();

  initialLoad.resolve({
    docId: "doc-1",
    data: {
      title: "Stored Title",
      content: "Stored Content",
    },
    timestamp: 1,
  });

  await Promise.resolve();
  await Promise.resolve();

  const lastPush = pushes.at(-1);

  if (!lastPush) {
    throw new Error("Expected a push after initial load completed");
  }

  if (lastPush.data.title !== "Edited Before Load") {
    throw new Error(`Expected edited title, got ${lastPush.data.title}`);
  }

  if (lastPush.data.content !== "Stored Content") {
    throw new Error(`Expected stored content, got ${lastPush.data.content}`);
  }

  disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

运行：

```bash
rtk pnpm exec tsx --tsconfig packages/frontend/core/tsconfig.json /private/tmp/malphite-tests/doc-frontend-race-test.ts
```

通过标准：

- 命令 exit code 是 0
- 终端没有抛出 `Expected no push before initial load`
- 终端没有抛出 `Expected edited title`
- 终端没有抛出 `Expected stored content`

### 11.3 手工验收建议

至少手工检查这几件事：

1. 打开 workspace 后，workbench header 能看到 `Sync: synced` 状态。
2. 新建文档后，旧文档内容不会被一起重写。
3. 打开某篇文档，改标题后：
   - 当前页标题立刻变
   - 返回 All Docs，列表标题也立刻变
   - 刷新后标题仍保留
4. 改正文后刷新，正文仍保留。
5. 快速打开文档并立刻输入时，不会被初次加载把本地输入冲掉。

## 12. 你现在应该形成的心智模型

如果你读完这一章，只带走一句话，那应该是这句：

**C4 不是先做“更高级的同步协议”，而是先把 workspace 生命周期、sync 启动编排、文档边界整理干净。**

再说白一点：

- `WorkspaceEngine` 解决“什么时候启动、什么时候停止”
- `SyncEngine` 解决“同步当前处于什么状态”
- `DocService` 解决“列表知道有哪些文档”
- `DocEntity` 解决“当前这篇文档的内存状态是什么”
- `DocFrontend` 解决“这篇文档怎么和存储双向同步”

等这几层都站稳，你再去接 Yjs、远端 provider、awareness、state vector，复杂度才是可控的。

## 13. 和上一篇的衔接

上一篇 `docs/web-from-zero-to-affine-style-phase2-teaching-rewrite.md` 主要讲的是：

- 为什么要从整包 workspace 存储转向 per-doc 存储
- 为什么要有 `DocFrontend`
- 为什么 C4 不能只是一个没接线的 `SyncEngine`

这一篇则把那几个“下一步要做的事”真的落成了代码章节。

如果你准备继续往后学，下一步最自然的方向就是：

1. 继续增强 `SyncEngine` 的状态机
2. 给 sync 增加更明确的错误和恢复语义
3. 再往后才是把 JSON snapshot 模型换成真正的 Yjs update 模型

顺序不要反。
