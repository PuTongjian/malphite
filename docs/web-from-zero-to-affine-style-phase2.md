# 从骨架到肌肉：让 toy 项目继续靠近 AFFiNE（第二阶段）

> 这份计划接在 `web-from-zero-to-affine-style.md` 之后。
>
> **文档约定**：下文每个实现步骤都给出**完整文件代码**（可直接复制到对应路径），用 `// ←` 注释标出相对当前代码的新增/修改点。不再使用 `...` 省略片段。

---

## 0. 你现在在哪

上一份教程的 15 个提交基本都落地了。当前已有：薄入口、Framework DI、LiveData、workspace scope、async storage + worker IndexedDB、Workbench 多 view、browser adapter、ViewScope/ViewRoot。

还缺的核心能力：

1. **Entity** —— `View`/`Doc` 应通过 `createEntity` 创建，框架管生命周期
2. **Store** —— 数据访问从 `DocService` 剥出
3. **声明式模块注册** —— workspace 内 service 不再写死在 `open()` 里
4. **per-doc scope** —— 打开 doc = 独立 scope + 引用计数
5. **update 流存储** —— 从整包快照升级到按 doc 粒度
6. **per-view history** —— 每个 tab 有自己的前进/后退栈

### 0.1 实现进度

| 口径 | 进度 |
| --- | --- |
| 相对上一份教程目标 | **≈ 95%** |
| 相对真实 AFFiNE 浏览器主线 | **≈ 34%** |
| 本阶段目标（A–D + E1 做完） | **≈ 55–60%** |

### 0.2 本阶段顺序

```text
Entity（可多实例） → Store（数据访问层） → 声明式 scope 注册
→ DocScope + Doc entity → update 流存储 → per-view history
```

---

## Phase A：Framework 长出 Entity / Store

### A0. 修 `WorkspacesService.get`（已有则跳过）

文件：`packages/frontend/core/src/modules/workspace/workspaces-service.ts`

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
    // ← 修复：find 回调必须 return，否则永远 undefined
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

---

### A2. Framework 支持 Entity

文件：`packages/frontend/core/src/framework/framework.ts`

```ts
// Service：scope 内单例，get() 时创建并缓存
// Entity：scope 内可多实例，createEntity() 每次新建、不缓存

export type Constructor<T> = new (...args: never[]) => T;
export type Factory<T> = (provider: FrameworkProvider) => T;
export type EntityFactory<T, P> = (provider: FrameworkProvider, props: P) => T;

export class Framework {
  // ← 拆成两张表：service 和 entity 分开注册
  private services = new Map<Constructor<unknown>, Factory<unknown>>();
  private entities = new Map<
    Constructor<unknown>,
    EntityFactory<unknown, unknown>
  >();

  service<T>(token: Constructor<T>, factory: Factory<T>) {
    this.services.set(token, factory);
    return this;
  }

  // ← 新增：注册 Entity 工厂，工厂接收 props
  entity<T, P = void>(token: Constructor<T>, factory: EntityFactory<T, P>) {
    this.entities.set(token, factory as EntityFactory<unknown, unknown>);
    return this;
  }

  provider(parent: FrameworkProvider | null = null) {
    return new FrameworkProvider(this, parent);
  }

  getServiceFactory<T>(token: Constructor<T>) {
    return this.services.get(token) as Factory<T> | undefined;
  }

  getEntityFactory<T, P>(token: Constructor<T>) {
    return this.entities.get(token) as EntityFactory<T, P> | undefined;
  }
}

export class FrameworkProvider {
  private cache = new Map<Constructor<unknown>, unknown>();
  // ← 登记所有创建出来的实例，dispose 时逆序清理
  private disposables: Array<{ dispose?: () => void }> = [];

  constructor(
    private framework: Framework,
    private parent: FrameworkProvider | null = null,
  ) {}

  get<T>(token: Constructor<T>): T {
    if (this.cache.has(token)) {
      return this.cache.get(token) as T;
    }

    const factory = this.framework.getServiceFactory(token);
    if (!factory) {
      if (this.parent) {
        return this.parent.get(token);
      }
      throw new Error(`Service not found: ${token.name}`);
    }

    const instance = factory(this);
    this.cache.set(token, instance);
    this.disposables.push(instance as { dispose?: () => void });
    return instance;
  }

  // ← 新增：不缓存，每次 createEntity 都是新实例
  createEntity<T, P = void>(token: Constructor<T>, props: P): T {
    const factory = this.framework.getEntityFactory<T, P>(token);
    if (!factory) {
      if (this.parent) {
        return this.parent.createEntity(token, props);
      }
      throw new Error(`Entity not found: ${token.name}`);
    }

    const instance = factory(this, props);
    this.disposables.push(instance as { dispose?: () => void });
    return instance;
  }

  createChild(configure: (framework: Framework) => void) {
    const childFramework = new Framework();
    configure(childFramework);
    return childFramework.provider(this);
  }

  dispose() {
    // 逆序：后创建的先销毁（子 scope 先于父 scope 里的对象）
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      this.disposables[i]?.dispose?.();
    }
    this.disposables = [];
    this.cache.clear();
  }
}
```

对照 AFFiNE：`packages/common/infra/src/framework/core/provider.ts`

---

### A3. View 改为 Entity

#### 文件 1：`packages/frontend/core/src/modules/workbench/view.ts`

```ts
import { LiveData } from "~/src/shared/live-data";

// ← Entity 创建时由框架传入的 props
export type ViewProps = {
  initialPath: string;
  title: string;
};

export function normalizePath(path: string) {
  if (path === "" || path === "/") {
    return "/all";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function getViewTitle(path: string) {
  if (path === "/all") return "All Docs";
  if (path === "/settings") return "Settings";
  return path.slice(1);
}

// ← View 是 Entity：一个 workspace 内可有多个，各自有 path$ 和 dispose
export class View {
  path$ = new LiveData("");
  readonly title: string;

  constructor(
    public readonly id: string,
    props: ViewProps,
  ) {
    this.path$.set(normalizePath(props.initialPath));
    this.title = props.title;
  }

  get path() {
    return this.path$.value;
  }

  navigate(path: string) {
    this.path$.set(normalizePath(path));
  }

  dispose() {
    // Phase D 会在这里清理 history 订阅
  }
}

// ← 主 tab 在框架启动前就存在，手动 new 即可（不走 createEntity）
export const MAIN_VIEW = new View("main", {
  initialPath: "/all",
  title: "All Docs",
});
```

#### 文件 2：`packages/frontend/core/src/modules/workbench/index.ts`（新建）

```ts
import type { Framework, FrameworkProvider } from "~/src/framework/framework";
import { View, type ViewProps } from "./view";
import { WorkbenchService } from "./workbench-service";

export function configureWorkbenchModule(framework: Framework) {
  framework
    // ← View 注册为 Entity：每次 open tab 都 createEntity
    .entity(View, (_provider, props: ViewProps) => {
      return new View(crypto.randomUUID(), props);
    })
    // ← WorkbenchService 需要 provider，才能在里面 createEntity
    .service(WorkbenchService, (provider: FrameworkProvider) => {
      return new WorkbenchService(provider);
    });
}
```

#### 文件 3：`packages/frontend/core/src/modules/workbench/workbench-service.ts`

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { LiveData } from "~/src/shared/live-data";
import { getViewTitle, MAIN_VIEW, normalizePath, View } from "./view";

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  // ← 注入 provider，用于 createEntity(View, props)
  constructor(private provider: FrameworkProvider) {}

  get activeView() {
    return (
      this.views$.value.find((view) => view.id === this.activeViewId$.value) ??
      this.views$.value[0]
    );
  }

  open(path: string) {
    const normalizedPath = normalizePath(path);

    const existing = this.views$.value.find((view) => {
      return view.path === normalizedPath;
    });

    if (existing) {
      this.activeViewId$.set(existing.id);
      return existing;
    }

    // ← 不再 new View()，改由框架 createEntity
    const view = this.provider.createEntity(View, {
      initialPath: normalizedPath,
      title: getViewTitle(normalizedPath),
    });

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);
    return view;
  }

  activate(id: string) {
    const exists = this.views$.value.some((view) => view.id === id);
    if (exists) {
      this.activeViewId$.set(id);
    }
  }

  close(id: string) {
    const views = this.views$.value;
    if (views.length <= 1) return;

    const closedIndex = views.findIndex((view) => view.id === id);
    if (closedIndex === -1) return;

    const closedView = views[closedIndex];
    const nextViews = views.filter((view) => view.id !== id);

    this.views$.set(nextViews);

    // ← 关闭 tab 时销毁 Entity
    closedView.dispose();

    if (this.activeViewId$.value === id) {
      const nextActiveView =
        nextViews[Math.min(closedIndex, nextViews.length - 1)];
      this.activeViewId$.set(nextActiveView?.id ?? "");
    }
  }
}
```

验收：开多个 tab，关其中一个时 `closedView.dispose()` 被调用，其它 tab 不受影响。

---

### A4. 引入 DocStore

#### 文件 1：`packages/frontend/core/src/modules/doc/doc-store.ts`（新建）

```ts
import type { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import type { Doc } from "./doc-types";

// Store：只负责读写底层数据，不含 create/rename 等业务逻辑
// Phase C 会把 load/save 整包改成 getDoc/pushDocUpdate，改动只发生在这里
export class DocStore {
  constructor(private storage: DocStorageService) {}

  load(workspaceId: string): Promise<Doc[]> {
    return this.storage.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]): Promise<void> {
    return this.storage.save(workspaceId, docs);
  }
}
```

#### 文件 2：`packages/frontend/core/src/modules/doc/doc-service.ts`

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
    private store: DocStore, // ← 不再直接依赖 DocStorageService
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
      const stored = await this.store.load(this.workspaceService.id);
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
      await this.store.save(this.workspaceService.id, docs);
    } catch (error) {
      this.error$.set(toError(error));
    }
  }
}
```

#### 文件 3：`packages/frontend/core/src/modules/doc/index.ts`（新建）

```ts
import type { Framework } from "~/src/framework/framework";
import { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";

export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (provider) => {
      return new DocStore(provider.get(DocStorageService));
    })
    .service(DocService, (provider) => {
      return new DocService(
        provider.get(WorkspaceService),
        provider.get(DocStore),
      );
    });
}
```

---

### A5. workspace 内注册改为声明式

#### 文件 1：`packages/frontend/core/src/modules/workspace/index.ts`（新建）

```ts
import type { Framework } from "~/src/framework/framework";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export function configureWorkspaceScopeModule(framework: Framework) {
  framework.service(WorkspaceService, (provider) => {
    return new WorkspaceService(provider.get(WorkspaceScope));
  });
}
```

#### 文件 2：`packages/frontend/core/src/modules/workspace/workspaces-service.ts`（A5 完整版）

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { configureDocModule } from "~/src/modules/doc";
import { configureWorkbenchModule } from "~/src/modules/workbench";
import { LiveData } from "~/src/shared/live-data";
import { configureWorkspaceScopeModule } from "./index";
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
    return this.workspaces$.value.find((workspace) => workspace.id === id);
  }

  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      // 1. 注册 scope props 载体
      framework.service(WorkspaceScope, () => new WorkspaceScope(meta));

      // 2. 各模块声明自己属于 workspace scope
      configureWorkspaceScopeModule(framework);
      configureDocModule(framework);
      configureWorkbenchModule(framework);
    });

    return new WorkspaceRef(meta, provider);
  }
}
```

**Phase A 验收**：`pnpm typecheck`，手动访问 `/workspace/local/all`，功能与改前一致。

---

## Phase B：Doc 成为实体，拥有自己的 scope

### B1. 新增 DocScope + Doc entity

#### 文件 1：`packages/frontend/core/src/modules/doc/doc-scope.ts`（新建）

```ts
export class DocScope {
  constructor(public readonly docId: string) {}
}
```

#### 文件 2：`packages/frontend/core/src/modules/doc/doc-entity.ts`（新建）

```ts
import { LiveData } from "~/src/shared/live-data";
import type { DocScope } from "./doc-scope";
import type { DocStore } from "./doc-store";

// Doc 是 Entity：一篇文档有自己的 title$/content$ 和生命周期
export class DocEntity {
  title$ = new LiveData("");
  content$ = new LiveData("");

  constructor(
    public readonly scope: DocScope,
    private store: DocStore,
  ) {}

  get id() {
    return this.scope.docId;
  }

  rename(title: string) {
    this.title$.set(title);
    // Phase C：改成 store.pushDocUpdate
  }

  setContent(content: string) {
    this.content$.set(content);
    // Phase C：改成 store.pushDocUpdate
  }

  dispose() {
    // Phase C：在这里断开 DocFrontend 订阅
  }
}
```

> 命名用 `DocEntity` 避免和 `doc-types.ts` 里的 `Doc` 类型冲突。Phase C 接入 Yjs 后可以把类型层和实体层进一步合并。

---

### B2. ObjectPool + DocsService

#### 文件 1：`packages/frontend/core/src/shared/object-pool.ts`（新建）

```ts
type PoolEntry<T> = {
  obj: T;
  refs: number;
};

export type PoolHandle<T> = {
  obj: T;
  release: () => void;
};

// 引用计数池：同一个 key 可被多次 get，refs 归零时 dispose
export class ObjectPool<T extends { dispose(): void }> {
  private map = new Map<string, PoolEntry<T>>();

  get(key: string): PoolHandle<T> | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    entry.refs += 1;
    return {
      obj: entry.obj,
      release: () => this.release(key),
    };
  }

  put(key: string, obj: T): PoolHandle<T> {
    this.map.set(key, { obj, refs: 1 });
    return {
      obj,
      release: () => this.release(key),
    };
  }

  private release(key: string) {
    const entry = this.map.get(key);
    if (!entry) return;

    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.obj.dispose();
      this.map.delete(key);
    }
  }
}
```

#### 文件 2：`packages/frontend/core/src/modules/doc/docs-service.ts`（新建）

```ts
import type { FrameworkProvider } from "~/src/framework/framework";
import { LiveData } from "~/src/shared/live-data";
import { ObjectPool, type PoolHandle } from "~/src/shared/object-pool";
import type { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { DocEntity } from "./doc-entity";
import { DocScope } from "./doc-scope";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";
import type { Doc } from "./doc-types";

export type DocOpenHandle = PoolHandle<{
  doc: DocEntity;
  provider: FrameworkProvider;
  dispose: () => void;
}>;

export class DocsService {
  private pool = new ObjectPool<{ dispose(): void }>();

  constructor(
    private provider: FrameworkProvider,
    private workspaceService: WorkspaceService,
    private listService: DocService,
  ) {}

  // workspace 级文档列表（仍由 DocService 管）
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

  // 打开单个 doc：创建 DocScope child provider，引用计数复用
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
        // DocStore 不在这里注册：provider.get(DocStore) 会向上冒泡到 workspace
        // scope 拿那一个共享实例。child scope 只放 DocScope + DocEntity。
        .entity(DocEntity, (p, _props) => {
          return new DocEntity(p.get(DocScope), p.get(DocStore));
        });
    });

    // 从列表里灌入初始数据
    const record = this.listService.get(docId);
    const docEntity = docProvider.createEntity(DocEntity, undefined as never);
    if (record) {
      docEntity.title$.set(record.title);
      docEntity.content$.set(record.content);
    }

    const handle = {
      doc: docEntity,
      provider: docProvider,
      dispose: () => docProvider.dispose(),
    };

    const pooled = this.pool.put(docId, handle);
    return { obj: handle, release: pooled.release };
  }
}
```

> **实现提示**：上面 `DocStore` 在 doc child scope 里应从 parent 冒泡获取（`provider.get(DocStore)` 会向上找 workspace scope 里注册的那个）。`createEntity(DocEntity)` 也可改成在 `entity()` 注册里直接 `new DocEntity(...)` 并用 `provider.get()` 取到，按你偏好二选一，关键是 **doc child scope 只放 DocScope + DocEntity**。

更干净的 `open` 写法（推荐）：

```ts
open(docId: string): DocOpenHandle {
  const existing = this.pool.get(docId);
  if (existing) {
    return { obj: existing.obj as DocOpenHandle["obj"], release: existing.release };
  }

  const docProvider = this.provider.createChild((framework) => {
    framework
      .service(DocScope, () => new DocScope(docId))
      .entity(DocEntity, (p) => {
        return new DocEntity(p.get(DocScope), p.get(DocStore));
      });
  });

  const record = this.listService.get(docId);
  const docEntity = docProvider.createEntity(DocEntity, undefined as never);
  if (record) {
    docEntity.title$.set(record.title);
    docEntity.content$.set(record.content);
  }

  const handle = {
    doc: docEntity,
    provider: docProvider,
    dispose: () => docProvider.dispose(),
  };

  const pooled = this.pool.put(docId, handle);
  return { obj: handle, release: pooled.release };
}
```

在 `configureDocModule` 里追加 `DocsService` 注册：

```ts
import type { Framework, FrameworkProvider } from "~/src/framework/framework";
import { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";
import { DocsService } from "./docs-service";

export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (provider) => {
      return new DocStore(provider.get(DocStorageService));
    })
    .service(DocService, (provider) => {
      return new DocService(
        provider.get(WorkspaceService),
        provider.get(DocStore),
      );
    })
    // 注意：不在 workspace scope 注册 DocEntity。它依赖 DocScope，
    // 而 DocScope 只存在于 DocsService.open 创建的 doc child scope 里，
    // 所以 DocEntity 也只在那个 child scope 注册（见 open 实现）。
    .service(DocsService, (provider: FrameworkProvider) => {
      return new DocsService(
        provider,
        provider.get(WorkspaceService),
        provider.get(DocService),
      );
    });
}
```

---

### B3. `useDocScope` hook

文件：`packages/frontend/core/src/modules/doc/use-doc-scope.ts`（新建）

```ts
import { useEffect, useState } from "react";
import { useService } from "~/src/framework/react";
import type { DocOpenHandle } from "./docs-service";
import { DocsService } from "./docs-service";

export function useDocScope(docId: string | undefined) {
  const docsService = useService(DocsService);
  const [handle, setHandle] = useState<DocOpenHandle | null>(null);

  useEffect(() => {
    if (!docId) {
      setHandle(null);
      return;
    }

    const opened = docsService.open(docId);
    setHandle(opened);

    return () => {
      opened.release();
      setHandle(null);
    };
  }, [docId, docsService]);

  return handle;
}
```

---

### B3. 页面改用 `useDocScope`

文件：`packages/frontend/core/src/pages/workspace/doc-page.tsx`

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

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  if (!docId || !docHandle) {
    return <div>Loading doc...</div>;
  }

  const doc = docHandle.obj.doc;
  const title = useLiveData(doc.title$);

  return (
    <article>
      <input
        value={title}
        onChange={(event) => doc.rename(event.target.value)}
      />
      <p>{useLiveData(doc.content$) || "Empty doc"}</p>
    </article>
  );
}

// 保留给外层 react-router 用的包装（当前 ViewRoot 直接传 docId，可不 export）
export function DocPage() {
  return null;
}
```

> **React 规则提示**：上面 `useLiveData` 不能在条件分支后调用。实际实现时应把 `title` / `content` 的 `useLiveData` 提到组件顶部，用 `docHandle?.obj.doc` 判空后再渲染。完整合规版：

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

  const doc = docHandle?.obj.doc ?? null;

  if (error) return <div>{error.message}</div>;
  if (!ready) return <div>Loading docs...</div>;
  if (!docId || !doc) return <div>Loading doc...</div>;

  return <DocPageEditor doc={doc} />;
}

function DocPageEditor({ doc }: { doc: NonNullable<ReturnType<typeof useDocScope>>["obj"]["doc"] }) {
  const title = useLiveData(doc.title$);
  const content = useLiveData(doc.content$);

  return (
    <article>
      <input
        value={title}
        onChange={(event) => doc.rename(event.target.value)}
      />
      <p>{content || "Empty doc"}</p>
    </article>
  );
}
```

**Phase B 验收**：

1. 两个 view 打开同一 `docId`，pool refs = 2，只一个 `DocEntity`
2. 关一个 view，refs = 1，doc 不销毁
3. 两个都关，refs = 0，`docProvider.dispose()`

---

## Phase C：存储升级成 update 流

### C1. update-based 存储接口

文件：`packages/frontend/core/src/modules/storage/doc-storage.ts`（新建）

```ts
export type DocRecordData = {
  title: string;
  content: string;
};

export type DocRecord = {
  docId: string;
  // 真实 AFFiNE 这里是 Uint8Array（Yjs update）
  // toy 版先用 JSON 快照，Phase E1 再换二进制
  data: DocRecordData;
  timestamp: number;
};

export interface DocStorage {
  getDoc(docId: string): Promise<DocRecord | null>;
  pushDocUpdate(docId: string, data: DocRecordData): Promise<void>;
  getDocList(workspaceId: string): Promise<string[]>;
  // pushDocUpdate 只管单篇内容、不知道 workspace，所以文档列表要单独维护。
  // 由持有完整列表的 DocStore.save 调 setDocList，否则新建的 doc 进不了 getDocList。
  setDocList(workspaceId: string, docIds: string[]): Promise<void>;
  subscribeDocUpdate(callback: (docId: string) => void): () => void;
}
```

文件：`packages/frontend/core/src/modules/doc/doc-store.ts`（Phase C 完整版）

```ts
import type { DocStorage, DocRecordData } from "~/src/modules/storage/doc-storage";
import type { Doc } from "./doc-types";

export class DocStore {
  constructor(
    private storage: DocStorage,
    private workspaceId: string,
  ) {}

  // --- Phase C 新接口 ---

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

  // --- 过渡期保留整包接口，给 DocService 列表用 ---

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

  async save(workspaceId: string, docs: Doc[]) {
    for (const doc of docs) {
      await this.storage.pushDocUpdate(doc.id, {
        title: doc.title,
        content: doc.content,
      });
    }
    // 维护 workspace -> docIds 列表，否则 getDocList 读不到新建的 doc。
    // 整包覆盖也顺带处理了"删除的 doc"（不在数组里就从列表消失）。
    await this.storage.setDocList(
      workspaceId,
      docs.map((doc) => doc.id),
    );
  }
}
```

---

### C2. IndexedDB 版 DocStorage 实现

文件：`packages/frontend/app/web/src/doc-storage-idb.ts`（Phase C 完整版）

```ts
import type { Doc, DocRecord, DocStorage } from "@malphite/core";

const DB_NAME = "malphite-doc-storage";
// ← 新 store：按 docId 存 DocRecord。不要复用 Phase 1 的 "docs"
//   （那个按 workspaceId 存 Doc[]，key 和 value 都不一样，复用会冲突）。
const DOC_STORE = "doc-records";
const META_STORE = "meta";
// ← Phase 1 worker 旧 store，仅给下面遗留的 loadDocs/saveDocs 用
const LEGACY_DOC_STORE = "docs";
const DB_VERSION = 2;

type MetaRecord = {
  workspaceId: string;
  docIds: string[];
};

let databasePromise: Promise<IDBDatabase> | null = null;

// 跨 tab 通知：BroadcastChannel 管 tab 之间，本地 Set 管同一个 runtime。
// 关键点：模块级 Set 只能通知同一 JS runtime 的订阅者，单靠它无法跨 tab；
// 而 BroadcastChannel 不会把消息回投给发送方自己，所以两者都要。
const subscribers = new Set<(docId: string) => void>();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("malphite-doc-update")
    : null;

channel?.addEventListener(
  "message",
  (event: MessageEvent<{ docId: string }>) => {
    for (const cb of subscribers) {
      cb(event.data.docId);
    }
  },
);

function notify(docId: string) {
  for (const cb of subscribers) {
    cb(docId);
  }
  channel?.postMessage({ docId });
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(LEGACY_DOC_STORE)) {
        db.createObjectStore(LEGACY_DOC_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
    };
  });

  return databasePromise;
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key) as IDBRequest<T>;
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function createIndexedDbDocStorage(): DocStorage {
  return {
    async getDoc(docId: string) {
      return (await idbGet<DocRecord>(DOC_STORE, docId)) ?? null;
    },

    async pushDocUpdate(docId: string, data: DocRecord["data"]) {
      const record: DocRecord = {
        docId,
        data,
        timestamp: Date.now(),
      };
      await idbPut(DOC_STORE, docId, record);
      notify(docId);
    },

    async getDocList(workspaceId: string) {
      const meta = await idbGet<MetaRecord>(META_STORE, workspaceId);
      return meta?.docIds ?? [];
    },

    async setDocList(workspaceId: string, docIds: string[]) {
      await idbPut(META_STORE, workspaceId, {
        workspaceId,
        docIds,
      } satisfies MetaRecord);
    },

    subscribeDocUpdate(callback: (docId: string) => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}

// ⚠️ 以下是 Phase 1 worker 旧路径的遗留函数（store="docs"，按 workspaceId 存 Doc[]）。
// Phase C 起 doc 数据走主线程 createIndexedDbDocStorage（store="doc-records"），
// 不再经过 worker。保留它们只是让 doc-storage.worker.ts 仍能编译；新流程不应再调用。
export async function loadDocs(workspaceId: string): Promise<Doc[]> {
  return (await idbGet<Doc[]>(LEGACY_DOC_STORE, workspaceId)) ?? [];
}

export async function saveDocs(workspaceId: string, docs: Doc[]) {
  await idbPut(LEGACY_DOC_STORE, workspaceId, docs);
}
```

---

### C3. DocFrontend（连接 DocEntity 与存储）

文件：`packages/frontend/core/src/modules/doc/doc-frontend.ts`（新建）

```ts
import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    // 应用"远端/加载来的数据"时打开这个开关，让下面的 push 跳过，
    // 否则一加载就把同样的数据又写回存储、再 notify，形成无谓回声。
    let applyingRemote = false;
    const applyRecord = (record: { data: { title: string; content: string } }) => {
      applyingRemote = true;
      doc.title$.set(record.data.title);
      doc.content$.set(record.data.content);
      applyingRemote = false;
    };

    // 1. 加载已有数据
    void this.storage.getDoc(doc.id).then((record) => {
      if (record) applyRecord(record);
    });

    // 2. 订阅远端 / 其它 tab 的更新
    const unsubscribeRemote = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((record) => {
        if (record) applyRecord(record);
      });
    });

    // 3. 本地改动 -> push update
    let pushing = false;
    let dirty = false;
    const push = () => {
      if (applyingRemote) return; // 远端写入触发的 set，不要再 push 回去
      if (pushing) {
        dirty = true; // 进行中又改了，标记一下，完成后补一次（否则丢掉最后一次编辑）
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

    const stopTitle = doc.title$.subscribe(push);
    const stopContent = doc.content$.subscribe(push);

    return () => {
      unsubscribeRemote();
      stopTitle();
      stopContent();
    };
  }
}
```

在 `DocsService.open` 里，`docEntity` 创建后调用 `docFrontend.connect(docEntity)`，把返回的 cleanup 放进 `handle.dispose` 链。

> **接线与线程边界（Phase C 必读）**
>
> Phase B 的 `DocStore` 依赖 `DocStorageService`（load/save 整包）；Phase C 改成依赖新的 `DocStorage`（按 doc 粒度）。这里有两个必须补的接线，文档前面没展开，补在这里：
>
> 1. **storage 跑在哪个线程**。`subscribeDocUpdate` 要在主线程被 `DocFrontend` 订阅，而 Phase 1 的 worker RPC 只有"请求-响应"，没有 worker→主线程的主动推送通道。最小可行做法是：**Phase C 把 doc 存储放回主线程**（IndexedDB 主线程也能用），Phase 1 的 worker 在 doc 流程里被旁路。这是刻意的简化——真实 AFFiNE 用 worker + 一条订阅 RPC 把它留在 worker 里，这里先不做，但要清楚边界在哪。
> 2. **用一个 class 当 DI token**，因为框架按 Constructor 找 service，接口不能当 token。

在 `doc-storage.ts` 末尾加 token holder（和 `DocStorageProvider` 同一套路）：

```ts
export class DocStorageHandle {
  constructor(public readonly storage: DocStorage) {}
}
```

`core/src/index.ts` 增加导出（worker 文件和 app 入口要用）：

```ts
export type {
  DocRecord,
  DocRecordData,
  DocStorage,
} from "./modules/storage/doc-storage";
export { DocStorageHandle } from "./modules/storage/doc-storage";
```

`configureDocModule`（Phase C 版）把 `DocStore` 改接 `DocStorage` + workspaceId，并注册 `DocFrontend`：

```ts
import type { Framework, FrameworkProvider } from "~/src/framework/framework";
import { DocStorageHandle } from "~/src/modules/storage/doc-storage";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { DocFrontend } from "./doc-frontend";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";
import { DocsService } from "./docs-service";

export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (provider) => {
      return new DocStore(
        provider.get(DocStorageHandle).storage,
        provider.get(WorkspaceService).id,
      );
    })
    .service(DocFrontend, (provider) => {
      return new DocFrontend(provider.get(DocStorageHandle).storage);
    })
    .service(DocService, (provider) => {
      return new DocService(
        provider.get(WorkspaceService),
        provider.get(DocStore),
      );
    })
    .service(DocsService, (provider: FrameworkProvider) => {
      return new DocsService(
        provider,
        provider.get(WorkspaceService),
        provider.get(DocService),
        provider.get(DocFrontend),
      );
    });
}
```

app 入口注册主线程 storage（`app/web/src/app.tsx`）：

```ts
import { DocStorageHandle } from "@malphite/core";
import { createIndexedDbDocStorage } from "./doc-storage-idb";

framework.service(DocStorageHandle, () => {
  return new DocStorageHandle(createIndexedDbDocStorage());
});
```

`DocsService` 多接一个 `DocFrontend`，在 `open` 里 `connect` 并把 cleanup 串进 `handle.dispose`：

```ts
constructor(
  private provider: FrameworkProvider,
  private workspaceService: WorkspaceService,
  private listService: DocService,
  private docFrontend: DocFrontend,
) {}

// open(...) 内，docEntity 创建之后：
const disconnect = this.docFrontend.connect(docEntity);
const handle = {
  doc: docEntity,
  provider: docProvider,
  dispose: () => {
    disconnect();
    docProvider.dispose();
  },
};
```

---

### C4. toy SyncEngine

文件：`packages/frontend/core/src/modules/storage/sync-engine.ts`（新建）

```ts
import { LiveData } from "~/src/shared/live-data";
import type { DocStorage } from "./doc-storage";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export class SyncEngine {
  state$ = new LiveData<SyncState>("idle");
  error$ = new LiveData<Error | null>(null);

  constructor(
    private local: DocStorage,
    // Phase E1 之后加 remotes: DocStorage[]
  ) {
    void local;
  }

  start() {
    this.state$.set("syncing");
    // toy：只有 local peer，直接标记 synced
    // 将来：对比 state vector，拉取/推送 update
    this.state$.set("synced");
  }

  stop() {
    this.state$.set("idle");
  }
}
```

UI 显示（在 `AllDocsPage` 或 `AppShell` 加一行）：

```tsx
import { useService } from "~/src/framework/react";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { useLiveData } from "~/src/shared/use-live-data";

function SyncStatus() {
  const sync = useService(SyncEngine);
  const state = useLiveData(sync.state$);
  return <span>Sync: {state}</span>;
}
```

**Phase C 验收**：

1. 改一个 doc 的 content，只 `pushDocUpdate` 该 doc
2. 两个 tab 开同一 doc，一个改，另一个通过 `subscribeDocUpdate` 更新
3. UI 显示 `SyncEngine.state$`

---

## Phase D：View 拥有自己的 history 和 router

### D1. View 完整版（带 history 栈）

文件：`packages/frontend/core/src/modules/workbench/view.ts`

```ts
import { LiveData } from "~/src/shared/live-data";

export type ViewProps = {
  initialPath: string;
  title: string;
};

export function normalizePath(path: string) {
  if (path === "" || path === "/") return "/all";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getViewTitle(path: string) {
  if (path === "/all") return "All Docs";
  if (path === "/settings") return "Settings";
  return path.slice(1);
}

export class View {
  // ← Phase D：用 location$ 表示当前位置，path$ 可保留作别名
  location$ = new LiveData("");
  readonly title: string;

  private entries: string[] = [];
  private cursor = -1;

  constructor(
    public readonly id: string,
    props: ViewProps,
  ) {
    this.title = props.title;
    this.push(normalizePath(props.initialPath), { replace: true });
  }

  // 兼容 Phase A–C 里还在用 path$ 的代码
  get path$() {
    return this.location$;
  }

  get path() {
    return this.location$.value;
  }

  get location() {
    return this.location$.value;
  }

  push(path: string, options?: { replace?: boolean }) {
    const normalized = normalizePath(path);

    if (options?.replace) {
      if (this.cursor < 0) {
        this.entries = [normalized];
        this.cursor = 0;
      } else {
        this.entries[this.cursor] = normalized;
      }
      this.location$.set(normalized);
      return;
    }

    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(normalized);
    this.cursor = this.entries.length - 1;
    this.location$.set(normalized);
  }

  replace(path: string) {
    this.push(path, { replace: true });
  }

  navigate(path: string) {
    this.push(path);
  }

  back() {
    if (this.cursor <= 0) return;
    this.cursor -= 1;
    this.location$.set(this.entries[this.cursor]);
  }

  forward() {
    if (this.cursor >= this.entries.length - 1) return;
    this.cursor += 1;
    this.location$.set(this.entries[this.cursor]);
  }

  dispose() {}
}

export const MAIN_VIEW = new View("main", {
  initialPath: "/all",
  title: "All Docs",
});
```

> **关于这套 history 栈的用途**：`entries` / `cursor` / `back` / `forward` 服务的是 **view 内部的前进/后退控件**（类似 AFFiNE 每个 tab 的返回箭头），需要你在 UI 上加按钮调用 `view.back()` / `view.forward()`，否则这套栈就是死代码。它和"浏览器后退"是两回事——浏览器后退由 browser history 负责（见 D2 的 `navigate` push/replace），不走这个栈。把 `popstate` 接到 `view.back()` 是更进一步的练习，这里先把栈建好。

---

### D2. browser adapter 完整版（支持 push / back）

文件：`packages/frontend/core/src/modules/workbench/use-bind-workbench-to-browser-router.ts`

```ts
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { LiveData } from "~/src/shared/live-data";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

const EMPTY_LOCATION$ = new LiveData("");

function splatToViewPath(splat: string | undefined) {
  if (!splat) return "/all";
  return splat.startsWith("/") ? splat : `/${splat}`;
}

function viewPathToSplat(viewPath: string) {
  if (viewPath === "/all") return "all";
  return viewPath.startsWith("/") ? viewPath.slice(1) : viewPath;
}

function buildBrowserPath(workspaceId: string, viewPath: string) {
  return `/workspace/${workspaceId}/${viewPathToSplat(viewPath)}`;
}

export function useBindWorkbenchToBrowserRouter() {
  const navigate = useNavigate();
  const { workspaceId, "*": splat } = useParams();
  const workbench = useService(WorkbenchService);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;
  const activeLocation = useLiveData(activeView?.location$ ?? EMPTY_LOCATION$);

  const syncSource = useRef<"browser" | "workbench" | null>(null);
  const lastPushedLocation = useRef<string | null>(null);

  // 浏览器 URL 变化 -> 更新 workbench active view
  useEffect(() => {
    if (!workspaceId) return;

    if (syncSource.current === "workbench") {
      syncSource.current = null;
      return;
    }

    syncSource.current = "browser";

    // 只 open/activate 对应 path 的 view。不要在这里 activeView?.replace(...)：
    // 此刻闭包里的 activeView 还是切换前的旧 view，replace 会改到错误的对象；
    // 而且 open 已经给新 view 设好 path、对已存在的 view 只激活，无需再 replace。
    workbench.open(splatToViewPath(splat));
  }, [workspaceId, splat, workbench]);

  // workbench active view 变化 -> 更新浏览器 URL
  useEffect(() => {
    if (!workspaceId || !activeView) return;

    if (syncSource.current === "browser") {
      syncSource.current = null;
      return;
    }

    const nextPath = buildBrowserPath(workspaceId, activeLocation);
    const currentPath = buildBrowserPath(
      workspaceId,
      splatToViewPath(splat),
    );

    if (nextPath === currentPath) return;

    // ← Phase D：新 location 用 push，重复 replace 用 replace
    const shouldPush = lastPushedLocation.current !== activeLocation;
    syncSource.current = "workbench";
    lastPushedLocation.current = activeLocation;

    navigate(nextPath, { replace: !shouldPush });
  }, [workspaceId, activeViewId, activeLocation, navigate, splat, activeView]);
}
```

---

### D3. ViewRoot 改用 per-view MemoryRouter

#### 文件 1：`packages/frontend/core/src/modules/workbench/view-routes.tsx`（新建）

```ts
import { useParams } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";

// /:docId 的 docId 要在 memory router 里用 useParams 取，
// 不能像早期写法那样写死成 docId={undefined}，否则 doc 页永远拿不到 id。
function DocRoute() {
  const { docId } = useParams();
  return <DocPageContent docId={docId} />;
}

export const viewRoutes: RouteObject[] = [
  { path: "/all", element: <AllDocsPage /> },
  { path: "/settings", element: <WorkspaceSettingsPage /> },
  { path: "/:docId", element: <DocRoute /> },
];
```

#### 文件 2：`packages/frontend/core/src/modules/workbench/view-root.tsx`（Phase D 完整版）

```ts
import { useLayoutEffect, useMemo } from "react";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { FrameworkRoot } from "~/src/framework/react";
import { useLiveData } from "~/src/shared/use-live-data";
import { useViewScope } from "./use-view-scope";
import { viewRoutes } from "./view-routes";
import type { View } from "./view";

export function ViewRoot({ view }: { view: View }) {
  const viewProvider = useViewScope(view);
  const location = useLiveData(view.location$);

  const viewRouter = useMemo(() => {
    return createMemoryRouter(viewRoutes, {
      initialEntries: [location || "/all"],
    });
  }, [view.id]); // 每个 view 只创建一次 router

  useLayoutEffect(() => {
    if (!location) return;
    void viewRouter.navigate(location);
  }, [location, viewRouter]);

  if (!viewProvider) return null;

  return (
    <FrameworkRoot framework={viewProvider}>
      <RouterProvider router={viewRouter} />
    </FrameworkRoot>
  );
}
```

**Phase D 验收**：

1. tab 内 doc A → doc B → 浏览器后退，回到 doc A
2. 刷新后 URL 恢复当前 view location
3.（可选）split 两个 view 并排，各自 history 独立

---

## Phase E：Yjs → BlockSuite（展望，完整思路）

### E1. DocEntity 接 Yjs（最小 CRDT）

文件：`packages/frontend/core/src/modules/doc/doc-entity.ts`（Phase E1 完整版）

```ts
import * as Y from "yjs";
import { LiveData } from "~/src/shared/live-data";
import type { DocScope } from "./doc-scope";
import type { DocStore } from "./doc-store";

export class DocEntity {
  readonly ydoc = new Y.Doc();
  private ytitle: Y.Text;
  private ycontent: Y.Text;

  title$ = new LiveData("");
  content$ = new LiveData("");

  constructor(
    public readonly scope: DocScope,
    private store: DocStore,
  ) {
    this.ytitle = this.ydoc.getText("title");
    this.ycontent = this.ydoc.getText("content");

    // Yjs 变动 -> 同步到 LiveData（给 React 用）
    this.ytitle.observe(() => {
      this.title$.set(this.ytitle.toString());
    });
    this.ycontent.observe(() => {
      this.content$.set(this.ycontent.toString());
    });
  }

  get id() {
    return this.scope.docId;
  }

  rename(title: string) {
    this.ydoc.transact(() => {
      this.ytitle.delete(0, this.ytitle.length);
      this.ytitle.insert(0, title);
    });
  }

  setContent(content: string) {
    this.ydoc.transact(() => {
      this.ycontent.delete(0, this.ycontent.length);
      this.ycontent.insert(0, content);
    });
  }

  applyUpdate(update: Uint8Array, origin?: unknown) {
    Y.applyUpdate(this.ydoc, update, origin);
  }

  encodeUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  dispose() {
    this.ydoc.destroy();
  }
}
```

`DocFrontend.connect` 在 Phase E1 改为：

```ts
connect(doc: DocEntity) {
  // transaction origin 标记，用来区分"自己改的"和"远端 apply 进来的"。
  const REMOTE = "remote";

  // record.data 在 E1 之后是 { update: Uint8Array }（不再是 { title, content }）。
  // DocRecordData 这里应随之改成二进制形状；下面先用局部断言取出 update。
  const readUpdate = (record: DocRecord | null) =>
    (record?.data as { update?: Uint8Array } | undefined)?.update;

  // 加载：把存储里的整份状态 apply 进来（标 origin=REMOTE，避免下面又推回去）
  void this.storage.getDoc(doc.id).then((record) => {
    const update = readUpdate(record);
    if (update) doc.applyUpdate(update, REMOTE);
  });

  // 订阅远端 / 其它 tab
  const off = this.storage.subscribeDocUpdate((docId) => {
    if (docId !== doc.id) return;
    void this.storage.getDoc(docId).then((record) => {
      const update = readUpdate(record);
      if (update) doc.applyUpdate(update, REMOTE);
    });
  });

  // 本地 ydoc 改动 -> push。两个要点：
  // 1. origin === REMOTE 时跳过，否则远端 apply 会立刻被推回去形成回声。
  // 2. toy 简化：存整份快照 encodeStateAsUpdate()，不是增量；
  //    覆盖式存储若只存最后一个增量，重载时会丢历史。
  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE) return;
    void this.storage.pushDocUpdate(doc.id, {
      update: doc.encodeUpdate(),
    } as never);
  };
  doc.ydoc.on("update", onUpdate);

  return () => {
    off();
    doc.ydoc.off("update", onUpdate);
  };
}
```

### E2. BlockSuite（毕业项目，单独开一轮）

不在此展开全部代码（依赖 `@blocksuite/*` 体积大）。主线步骤：

1. workspace 持有 `WorkspaceImpl`（BlockSuite collection）
2. `DocsStore.getBlockSuiteDoc(id)` 从 collection 取 store
3. 新增 `EditorScope` + `EditorService` + `Editor` entity
4. doc 页渲染 `<affine-editor-container>`，`onLoad` 时 `editor.bindEditorContainer(...)`

对照 AFFiNE：

```text
packages/frontend/core/src/modules/workspace/entities/workspace.ts
packages/frontend/core/src/modules/editor/entities/editor.ts
packages/frontend/core/src/desktop/pages/workspace/detail-page/
```

---

## 推荐提交顺序

```text
A0  修 WorkspacesService.get
A2  Framework 增加 entity / createEntity / 逆序 dispose
A3  View 改 Entity + configureWorkbenchModule + WorkbenchService 注入 provider
A4  DocStore + DocService 改依赖 Store
A5  configureXxxModule 声明式注册
B1  DocScope + DocEntity + ObjectPool + DocsService + useDocScope
B2  doc-page 改用 per-doc scope
C1  DocStorage update 接口 + DocStore 改造
C2  IndexedDB 按 doc 存储 + subscribe
C3  DocFrontend
C4  SyncEngine + UI 状态
D1  View history 栈
D2  browser adapter push/replace
D3  ViewRoot MemoryRouter
D4  （可选）split view
E1  Yjs content
E2  BlockSuite（单独 PR）
```

每步跑：`pnpm typecheck` + `pnpm malphite web dev`

---

## 完成本阶段后的位置

加权估算从 **≈ 34%** 推到 **≈ 55–60%**。指北针：

```text
单例 → 实体（Entity + createEntity + dispose）
逻辑 → 数据访问（Store）
快照 → 更新流（pushDocUpdate + subscribe + SyncEngine）
单 path → 带历史的子路由（history + MemoryRouter）
```

把这四样咬合好，你的 toy 就不再只是"长得像 AFFiNE"，而是"用 AFFiNE 的方式在思考"。
