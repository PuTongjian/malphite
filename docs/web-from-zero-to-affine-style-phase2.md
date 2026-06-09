# 从骨架到肌肉：让 toy 项目继续靠近 AFFiNE（第二阶段）

> 这份计划接在 `web-from-zero-to-affine-style.md` 之后。上一份把四层骨架（App / Framework / Workspace / Storage）的玩具版立了起来，并加上了 Workbench 多 view 和 browser adapter。这一份不再加新文件凑数，而是让已经存在的抽象在真实压力下**长出 AFFiNE 的形状**。
>
> 学习方式仍然是 Karpathy 式的：先做最小版本，让抽象被痛点逼出来，再去读真实源码。不要因为 AFFiNE 有某个类就照抄。每加一层，先问"现在哪里痛"。

---

## 0. 你现在在哪：代码快照

上一份教程列出的 15 个提交（含 settings 页、WorkspaceRef、async storage、worker IndexedDB、WorkbenchRoot、browser adapter、View class、ViewScope/ViewRoot）**基本都落地了**。当前真实文件：

```text
packages/frontend/app/web/src
  index.tsx            # 薄入口
  setup.ts             # 环境 bootstrap
  app.tsx              # 装配 Framework + worker driver
  doc-storage.worker.ts
  doc-storage-idb.ts   # worker 内 IndexedDB 持久化

packages/frontend/core/src
  framework/framework.ts        # Framework + FrameworkProvider（factory + cache + parent + dispose）
  framework/react.tsx           # FrameworkRoot / useService
  shared/live-data.ts           # 最小 LiveData（value/set/subscribe/map）
  shared/use-live-data.ts       # useSyncExternalStore 桥
  modules/index.ts              # configureCommonModules
  modules/site/site-service.ts
  modules/doc/doc-service.ts    # docs$/ready$/error$ + create/rename/load/save
  modules/doc/doc-types.ts      # Doc = { id, title, content }
  modules/storage/*             # DocStorageService/Provider + Local/Worker driver + RPC types
  modules/workspace/*           # WorkspacesService/WorkspaceService/Scope/Ref + useWorkspaceScope
  modules/workbench/*           # WorkbenchService/View/ViewScope/ViewRoot/WorkbenchRoot + browser adapter
  pages/*                       # workspace-route / all-docs / doc / settings
  router.tsx
```

这个位置非常好：四层骨架都能跑，异步和多 view 的压力也加上了。但它们还都是"单细胞"——只有 `Service`（单例），没有 `Entity`（可多次创建的有状态对象）和 `Store`（数据访问层）；doc 还是一坨快照数组；view 还没有自己的历史。

> 顺手修一个 bug：`workspaces-service.ts` 的 `get()` 里 `find` 回调写成了 `{ workspace.id === id; }`（块体没 `return`，永远返回 `undefined`）。应当是 `(w) => w.id === id`。这个在引入 ObjectPool 之前先修掉，否则后面按 id 找 workspace 会一直为空。

---

## 0.1 实现进度统计

进度要分两种口径，否则会误导自己。

**口径 A：相对"上一份教程的目标"** —— 上一份明确说本阶段只要四层玩具版 + 异步 + 多 view，不碰 BlockSuite/Yjs/cloud。按这个口径：

> **≈ 95%**。15 个提交全做了，只剩零碎收尾（上面那个 `get()` bug、split view 是可选项）。

**口径 B：相对"真实 AFFiNE 浏览器主线"** —— 这才是"靠近 AFFiNE"的真实标尺。按主线分层加权：

| 层 | 权重 | 你的玩具版覆盖 | 还缺的关键概念 | 估算 |
| --- | --- | --- | --- | --- |
| App bootstrap | 8% | 薄入口 / worker / 模块注册都有 | LifecycleService、SharedWorker、telemetry | ~70% |
| Framework / DI | 22% | factory + cache + parent + dispose | **Entity / Store 分层**、一等公民 Scope、`impl`/identifier 多实现、createScope/createEntity、EventBus | ~35% |
| LiveData / 响应式 | 8% | value/set/subscribe/map | `computed`、`from(observable)`、effect、RxJS 互操作 | ~30% |
| Workspace | 15% | list + open + scope + ref + dispose | ObjectPool 引用计数、flavour provider、WorkspaceEngine、ready 门控、事件 | ~45% |
| Storage / nbstore | 20% | async driver + worker RPC + IDB | SyncEngine、按 doc 粒度的 update 流、blob、通用 op 协议、DocFrontend、Yjs | ~25% |
| Workbench / View | 15% | 多 view + active + browser adapter + view scope | View 实体化、per-view history + MemoryRouter、split view、sidebar | ~40% |
| Doc / Editor / BlockSuite | 12% | plain `{id,title,content}` | DocsStore、Doc/Editor 实体、DocScope/EditorScope、BlockSuite、Yjs | ~8% |

加权合计：

```text
0.70*8 + 0.35*22 + 0.30*8 + 0.45*15 + 0.25*20 + 0.40*15 + 0.08*12
= 5.6 + 7.7 + 2.4 + 6.75 + 5.0 + 6.0 + 0.96
≈ 34%
```

> **结论：相对真实 AFFiNE 浏览器主线，你大约在 34%。** 骨架立起来了（这是最难的 0→1），但还没长肌肉。本阶段的目标是把这个数字推到 **≈ 55–60%**：补齐 Entity/Store/Scope 三层、把 doc 变成实体、把存储升级成 update 流、给 view 加历史。BlockSuite 留到本阶段末尾作为收尾展望。

这个百分比是**主观加权估算**，不是精确测量——它的价值在于告诉你"下一刀该切哪里"，不在于小数点。

---

## 0.2 本阶段心智模型（Karpathy 版）

上一阶段你证明了一件事：service factory + provider cache + scope + dispose 这套 DI，足够撑起一个多 workspace、多 view、异步存储的 app。漂亮。

这一阶段的关键观察是：**AFFiNE 比你多的，几乎全部来自三个"区分"**。它不是有更多文件，而是把你混在一起的东西分开了。

1. **Service vs Entity**：你现在所有东西都是 Service（单例、scope 内缓存）。但 `View`、`Doc`、`Workspace` 本质是"可以同时存在多个、各有生命周期"的对象——它们是 **Entity**。Entity 用 `createEntity` 创建，不缓存，可销毁。
2. **逻辑 vs 数据访问**：你的 `DocService` 既算业务（create/rename）又直接读写 storage。AFFiNE 把"读写底层数据"抽成 **Store**（类似 Repository）。Service 编排逻辑，Store 只管搬数据。
3. **手写 child provider vs 一等公民 Scope**：你用 `createChild((framework) => {...})` 手动注册一坨 service。AFFiNE 把 scope 变成注册时就声明的东西（`.scope(WorkspaceScope)` 之后的注册都绑到这个 scope），并用 `createScope(ScopeClass, props)` 携带 props 创建。

记住痛点驱动的顺序：

```text
先让单例长出"可多实例的实体"        (Entity)
再把"读数据"从"算逻辑"里剥出来      (Store)
再让 scope 从手写拼装变成声明式      (Scope 一等公民)
然后 doc 才配拥有自己的 scope 和实体  (DocScope + Doc entity)
然后存储才配从"存快照"变成"存更新流" (update-based storage / toy SyncEngine)
最后 view 才配拥有自己的历史和路由    (per-view history + MemoryRouter)
```

> 一句话：上一阶段你把"同步变异步、单 route 变多 view"；这一阶段你把"单例变实体、快照变更新流、view 变带历史的子应用"。

---

## Phase A：让 Framework 长出 Scope / Entity / Store

目标：把 DI 从"只有单例 service"升级到 AFFiNE 的三件套。这是本阶段最重要、收益最大的一步——它会让后面所有步骤都变顺。

### A1. 痛点先行

看 `workspaces-service.ts` 的 `open`：

```12:44:packages/frontend/core/src/modules/workspace/workspaces-service.ts
  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      framework
        .service(WorkspaceScope, () => new WorkspaceScope(meta))
        .service(WorkspaceService, (provider) => { ... })
        .service(DocService, (provider) => { ... })
        .service(WorkbenchService, () => new WorkbenchService());
    });
    return new WorkspaceRef(meta, provider);
  }
```

三个痛点：

1. 一个 workspace 内有哪些 service，是写死在 `open` 里的命令式代码。doc 模块、workbench 模块没法各自声明"我属于 workspace scope"。
2. `WorkspaceScope` 被当成一个普通 service，但它其实是"这一层的 props 载体"，语义被埋没了。
3. `View` 是 plain class，多个 view 共存靠 `WorkbenchService` 自己维护数组——它本该是 Entity。

### A2. 给 Framework 增加 Entity（可多实例、不缓存、可销毁）

`Service` 的语义是"这个 scope 里只有一个，第一次 get 时创建并缓存"。`Entity` 的语义是"我要几个就 `createEntity` 几个，每次都是新的，用完各自 dispose"。

修改 `framework/framework.ts`，区分两类注册：

```ts
export type Constructor<T> = new (...args: never[]) => T;
export type Factory<T> = (provider: FrameworkProvider) => T;
// Entity 工厂额外吃一个 props
export type EntityFactory<T, P> = (provider: FrameworkProvider, props: P) => T;

export class Framework {
  private services = new Map<Constructor<unknown>, Factory<unknown>>();
  private entities = new Map<Constructor<unknown>, EntityFactory<unknown, unknown>>();

  service<T>(token: Constructor<T>, factory: Factory<T>) {
    this.services.set(token, factory);
    return this;
  }

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
```

`FrameworkProvider` 增加 `createEntity`，并把所有创建出来的东西都登记进一个 `disposables`，dispose 时逆序清理：

```ts
export class FrameworkProvider {
  private cache = new Map<Constructor<unknown>, unknown>();
  private disposables: Array<{ dispose?: () => void }> = [];

  constructor(
    private framework: Framework,
    private parent: FrameworkProvider | null = null,
  ) {}

  get<T>(token: Constructor<T>): T {
    if (this.cache.has(token)) return this.cache.get(token) as T;

    const factory = this.framework.getServiceFactory(token);
    if (!factory) {
      if (this.parent) return this.parent.get(token);
      throw new Error(`Service not found: ${token.name}`);
    }

    const instance = factory(this);
    this.cache.set(token, instance);
    this.disposables.push(instance as { dispose?: () => void });
    return instance;
  }

  // 不缓存：每次都新建一个实体，并登记销毁
  createEntity<T, P = void>(token: Constructor<T>, props: P): T {
    const factory = this.framework.getEntityFactory<T, P>(token);
    if (!factory) {
      if (this.parent) return this.parent.createEntity(token, props);
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
    // 逆序 dispose：后创建的先销毁
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      this.disposables[i]?.dispose?.();
    }
    this.disposables = [];
    this.cache.clear();
  }
}
```

> 这就是 AFFiNE `createEntity({ noCache })` 的玩具版。区别只在于"缓存与否 + 是否携带 props"。真实 AFFiNE 还有 `ComponentCachePool` 和 `Symbol.dispose`，但**核心区分就是 service=单例、entity=多实例**。先理解这一点，再去看 `provider.ts` 的 `getOrCreateInstance`。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/framework/core/provider.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/framework/core/components/component.ts
```

### A3. 把 `View` 变成 Entity

`View` 是天生的 Entity：一个 workspace 内可以有 N 个 view，各自独立、各自销毁。

给 `View` 一个统一基类（可选，但有助于理解），并改成由 `createEntity` 创建。`view.ts`：

```ts
import { LiveData } from "~/src/shared/live-data";

export type ViewProps = { initialPath: string; title: string };

export class View {
  path$ = new LiveData("");

  constructor(
    public readonly id: string,
    props: ViewProps,
  ) {
    this.path$.set(normalizePath(props.initialPath));
    this.title = props.title;
  }

  readonly title: string;

  get path() {
    return this.path$.value;
  }

  navigate(path: string) {
    this.path$.set(normalizePath(path));
  }

  dispose() {
    // 后续 D 阶段会在这里清理 history/router 订阅
  }
}
```

注册（在 workspace scope 内）：

```ts
framework.entity(View, (_provider, props: ViewProps) =>
  new View(crypto.randomUUID(), props),
);
```

`WorkbenchService.open` 改成用 `createEntity`：

```ts
const view = this.provider.createEntity(View, {
  initialPath: normalizedPath,
  title: getViewTitle(normalizedPath),
});
```

（`WorkbenchService` 需要拿到它所在的 provider——让它的 factory 把 `provider` 传进构造函数即可。）

验收：打开多个 tab，关闭其中一个时，被关掉的 `View` 走了它自己的 `dispose`，其它 view 不受影响。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/entities/view.ts
```

### A4. 引入 Store，把数据访问从 `DocService` 剥出来

当前 `DocService` 同时做两件事：算业务（`create`/`rename` 维护内存数组）和读写存储（`load`/`save` 调 `DocStorageService`）。AFFiNE 的规矩是：**Service 编排逻辑，Store 只搬数据**。

新增 `modules/doc/doc-store.ts`：

```ts
import type { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import type { Doc } from "./doc-types";

// Store：只负责"读写底层数据"，不含业务判断
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

`DocService` 改成依赖 `DocStore` 而不是 `DocStorageService`：

```ts
export class DocService {
  docs$ = new LiveData<Doc[]>([]);
  error$ = new LiveData<Error | null>(null);
  ready$ = new LiveData(false);

  constructor(
    private workspaceService: WorkspaceService,
    private store: DocStore, // ← 不再直接持有 storage
  ) {
    void this.load();
  }

  // create/rename/get 逻辑不变，只是 save/load 走 this.store
}
```

> 现在的 `DocStore` 只是个转发壳子，看起来"没必要"。**这正是 Karpathy 说的：抽象要被痛点逼出来。** 它的价值在 Phase B/C 会兑现：当存储从"整包数组"变成"按 doc 粒度的 update 流"时，所有脏活都留在 Store 里，`DocService` 的业务逻辑一行不用改。先把缝切出来，肌肉后面长。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc/stores/docs.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc/services/docs.ts
```

### A5. 让 scope 注册声明式（可选但推荐）

把每个 workspace 内 service 的注册，从 `WorkspacesService.open` 里搬到各自模块的 `configureXxxWorkspaceModule(framework)`，由 `open` 统一调用。这样 doc 模块声明"我注册到 workspace child"，workbench 模块也是。

```ts
// modules/doc/index.ts
export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (p) => new DocStore(p.get(DocStorageService)))
    .service(DocService, (p) => new DocService(p.get(WorkspaceService), p.get(DocStore)))
    .entity(Doc, /* Phase B */);
}
```

`open` 变薄：

```ts
open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
  const provider = rootProvider.createChild((framework) => {
    framework.service(WorkspaceScope, () => new WorkspaceScope(meta));
    configureWorkspaceScopeModule(framework); // WorkspaceService
    configureDocModule(framework);
    configureWorkbenchModule(framework);
  });
  return new WorkspaceRef(meta, provider);
}
```

> 这一步不改运行时行为，纯粹是把"谁属于哪一层"变成可声明的。等你之后要分 web/electron 平台时，这个结构会让你只换一两行注册。AFFiNE 的 `.scope(WorkspaceScope).service(...).scope(DocScope).entity(...)` 就是这个思路的成熟体——同一个 framework 上用 `.scope()` 切换"当前注册到哪一层"。

**Phase A 验收**：功能不变，但 `View` 是 entity、`DocService` 不再直接碰 storage、workspace 内注册是声明式的。`pnpm typecheck` + 手动跑 `/workspace/local/all` 一切正常。

---

## Phase B：让 Doc 成为实体，拥有自己的 scope

目标：从"一个 workspace = 一坨 doc 数组"升级到"打开一个 doc = 创建一个 DocScope + Doc entity"。这是接编辑器的前提。

### B1. 痛点

现在 `DocPageContent` 是这么拿 doc 的：

```10:16:packages/frontend/core/src/pages/workspace/doc-page.tsx
export function DocPageContent({ docId }: DocPageContentProps) {
  const docService = useService(DocService);
  const docs = useLiveData(docService.docs$);
  const doc = docs.find((item) => item.id === docId);
```

问题：

1. 打开一个 doc 没有任何独立生命周期——它只是数组里的一个元素。
2. 将来编辑器要绑定到"这一个 doc"，需要 per-doc 的 scope（放 EditorService、selection、滚动位置）。现在无处可放。
3. 多个 view 打开同一个 doc，应该共享同一个 Doc 实例（引用计数），现在做不到。

### B2. 新增 DocScope + Doc entity

`modules/doc/doc-scope.ts`：

```ts
import type { Doc } from "./doc-entity";

export class DocScope {
  constructor(public readonly docId: string) {}
}
```

`modules/doc/doc-entity.ts`（把"单个文档"实体化）：

```ts
import { LiveData } from "~/src/shared/live-data";
import type { DocScope } from "./doc-scope";
import type { DocStore } from "./doc-store";

export class Doc {
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
    // 经由 store 持久化（Phase C 改成 update 流）
  }

  dispose() {}
}
```

### B3. DocsService.open + ObjectPool（引用计数）

把"workspace 级的 doc 列表/打开"和"单个 doc 实体"分开：

- `DocsService`（workspace scope）：管列表 + `open(docId)` 创建 DocScope。
- `DocService`（doc scope）：当前打开的这个 doc。

最小 ObjectPool：

```ts
// shared/object-pool.ts
export class ObjectPool<T extends { dispose(): void }> {
  private map = new Map<string, { obj: T; refs: number }>();

  get(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    e.refs++;
    return { obj: e.obj, release: () => this.release(key) };
  }

  put(key: string, obj: T) {
    this.map.set(key, { obj, refs: 1 });
    return { obj, release: () => this.release(key) };
  }

  private release(key: string) {
    const e = this.map.get(key);
    if (!e) return;
    e.refs--;
    if (e.refs <= 0) {
      e.obj.dispose();
      this.map.delete(key);
    }
  }
}
```

`DocsService.open(docId)`：

```ts
open(docId: string) {
  const existing = this.pool.get(docId);
  if (existing) return existing;

  const docProvider = this.provider.createChild((framework) => {
    framework
      .service(DocScope, () => new DocScope(docId))
      .service(DocService, (p) => new DocService(p.get(DocScope), p.get(DocStore)));
  });

  const doc = docProvider.get(DocService);
  return this.pool.put(docId, {
    dispose: () => docProvider.dispose(),
    doc,
  } as never);
}
```

页面在 effect 里 open/release（和 `useWorkspaceScope` 同构）：

```ts
// useDocScope(docId): open -> setRef -> cleanup release
```

**Phase B 验收**：

1. 两个 view 打开同一个 docId，只创建一个 Doc 实例（pool refs=2）。
2. 关闭其中一个 view，refs 降到 1，Doc 不销毁；两个都关，refs=0，DocScope dispose。
3. `/workspace/local/<docId>` 仍能渲染。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc/services/docs.ts   # open + ObjectPool
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc/entities/doc.ts
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/doc/scopes/doc.ts
```

---

## Phase C：把存储升级成 update 流（toy nbstore / SyncEngine 地基）

目标：从"存整包快照"升级到"存按 doc 粒度的更新流"。这是 nbstore / Yjs / 同步引擎的地基。**这是你离 AFFiNE 最远的一层（25%），也是最有 AFFiNE 味道的一层。**

### C1. 痛点

现在存储接口是：

```4:7:packages/frontend/core/src/modules/storage/doc-storage-service.ts
export interface DocStorageDriver {
  load(workspaceId: string): Promise<Doc[]>;
  save(workspaceId: string, docs: Doc[]): Promise<void>;
}
```

整包读写一个 workspace 的所有 doc。问题：

1. 改一个字就要重写整包，没法增量。
2. 没法表达"一个 doc 是一串随时间追加的更新"——而这正是 CRDT/Yjs 的本质。
3. 没法订阅"某个 doc 变了"，也就没法做同步。

### C2. update-based DocStorage 接口

把接口改成 AFFiNE nbstore 的玩具版——按 docId 操作，存的是"更新"（toy 版可以先用 JSON snapshot 当作一条 update，重点是接口形状对）：

```ts
export type DocRecord = {
  docId: string;
  // 真实 nbstore 这里是 Uint8Array（Yjs update）。
  // toy 版先用结构化快照，等接 Yjs 时再换成二进制。
  data: { title: string; content: string };
  timestamp: number;
};

export interface DocStorage {
  getDoc(docId: string): Promise<DocRecord | null>;
  pushDocUpdate(docId: string, data: DocRecord["data"]): Promise<void>;
  getDocList(): Promise<string[]>;
  subscribeDocUpdate(cb: (docId: string) => void): () => void;
}
```

`DocStore` 现在有意义了——它把"Doc 实体的字段读写"翻译成"对 DocStorage 的 update 调用"。`DocService` 的业务逻辑完全不动（这就是 Phase A 切缝的回报）。

### C3. toy DocFrontend

AFFiNE 有个 `DocFrontend`，负责把"内存里的 doc"和"存储里的 update 流"连起来：加载已有 update、订阅后续 update、把本地修改 push 回存储。写一个最小版：

```ts
export class DocFrontend {
  constructor(private storage: DocStorage) {}

  // 连接一个 Doc 实体：加载 + 双向同步
  connect(doc: Doc) {
    void this.storage.getDoc(doc.id).then((rec) => {
      if (rec) {
        doc.title$.set(rec.data.title);
        doc.content$.set(rec.data.content);
      }
    });

    const off = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((rec) => {
        if (rec) doc.content$.set(rec.data.content);
      });
    });

    // 本地改动 -> push
    const stop = doc.content$.subscribe(() => {
      void this.storage.pushDocUpdate(doc.id, {
        title: doc.title$.value,
        content: doc.content$.value,
      });
    });

    return () => { off(); stop(); };
  }
}
```

### C4. toy SyncEngine + state$

AFFiNE 的 `Sync` 管 local↔remote 多 peer 同步，并暴露 `state$`。你现在只有 local，但可以先把"形状"立起来——一个只有 local peer 的 SyncEngine，暴露 `state$`（idle/syncing/synced）：

```ts
export type SyncState = "idle" | "syncing" | "synced";

export class SyncEngine {
  state$ = new LiveData<SyncState>("idle");
  constructor(private local: DocStorage /*, private remotes: DocStorage[] */) {}

  start() {
    this.state$.set("syncing");
    // toy：local-only，立即 synced。
    // 将来加 remotes 时，这里 diff 两端 update 流。
    this.state$.set("synced");
  }
  stop() { this.state$.set("idle"); }
}
```

> 不要现在就实现真正的多 peer diff/merge——那需要 Yjs 的 state vector。**先把接口和状态机立起来，让 UI 能显示"正在同步/已同步"。** 当你之后接入 Yjs，`pushDocUpdate` 的 `data` 换成 `Uint8Array`，`SyncEngine` 才需要长出真正的 diff 逻辑。

worker 侧：把 `doc-storage.worker.ts` 的 RPC 方法从 `loadDocs/saveDocs` 换成 `getDoc/pushDocUpdate/getDocList/subscribeDocUpdate`。注意 `subscribeDocUpdate` 是长订阅——这会逼你的 worker RPC 从"一问一答"长出"服务端推送"，这正是 AFFiNE `OpConsumer` 的 `subscribe` 消息类型存在的原因。

**Phase C 验收**：

1. 改一个 doc 的 content，只 push 这一个 doc 的 update，不重写整包。
2. 两个 tab 开同一个 doc，一个改，另一个通过 `subscribeDocUpdate` 收到并更新（多 tab 实时同步的雏形）。
3. UI 能显示 `SyncEngine.state$`。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/storage/doc.ts        # DocStorage 接口
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/frontend/doc.ts        # DocFrontend
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/sync/index.ts          # Sync / state$
/Users/malphite/Desktop/Archive/AFFiNE/packages/common/infra/src/op/consumer.ts           # subscribe 类型的 RPC
```

---

## Phase D：让 View 拥有自己的 history 和 router

目标：从"View 只有一个 `path$`"升级到"每个 view 是一个带前进/后退历史的子应用"。

### D1. 痛点

你的 browser adapter 现在只同步 active view 的**单个 path**：

```50:66:packages/frontend/core/src/modules/workbench/use-bind-workbench-to-browser-router.ts
    const nextPath = buildBrowserPath(workspaceId, activeViewPath);
    ...
    navigate(nextPath, { replace: true });
```

它永远 `replace`，所以 tab 内没有"后退"。AFFiNE 里每个 view 有独立的 history 栈，可以在一个 tab 内前进/后退，且 split view 时每个分屏各走各的历史。

### D2. 给 View 一个 history 栈

```ts
export class View {
  private entries: string[] = [];
  private cursor = -1;
  location$ = new LiveData("");

  push(path: string) {
    const p = normalizePath(path);
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(p);
    this.cursor = this.entries.length - 1;
    this.location$.set(p);
  }

  replace(path: string) {
    const p = normalizePath(path);
    if (this.cursor < 0) return this.push(p);
    this.entries[this.cursor] = p;
    this.location$.set(p);
  }

  back() { if (this.cursor > 0) { this.cursor--; this.location$.set(this.entries[this.cursor]); } }
  forward() { if (this.cursor < this.entries.length - 1) { this.cursor++; this.location$.set(this.entries[this.cursor]); } }

  get location() { return this.location$.value; }
}
```

browser adapter 升级：view PUSH/REPLACE 决定 `navigate` 用 push 还是 replace；浏览器后退 → `view.back()`。用 `syncSource` ref 防循环（你已经有这个模式）。

### D3. per-view MemoryRouter（让 ViewRoot 真正成为子路由）

现在 `ViewRoot` 是手写 `if (path === "/all")` 分发。AFFiNE 里每个 view 跑一个 `createMemoryRouter`，由 `view.location$` 驱动。把 `ViewContent` 的 if-else 换成一个 memory router：

```ts
// view-root.tsx
const viewRouter = useMemo(() => createMemoryRouter(viewRoutes), []);
const location = useLiveData(view.location$);
useLayoutEffect(() => { void viewRouter.navigate(location); }, [location, viewRouter]);
return (
  <FrameworkRoot framework={viewProvider}>
    <RouterProvider router={viewRouter} />
  </FrameworkRoot>
);
```

> 这一步的"啊哈"在于：**外层 browser router 只负责到 workspace；workspace 内部每个 tab 是一个独立的 memory router 子应用。** 这就是 AFFiNE 双栈路由的本质。先做单 view 的 memory router，跑通了再考虑 split。

### D4.（可选）split view

`WorkbenchService` 已有 `views$` 数组。把 `WorkbenchRoot` 从"只渲染 activeView"改成"并排渲染多个 view"，每个 view 各自 `ViewRoot`。这会立刻暴露"每个 view 必须有独立 scope 和 history"——你前面都做好了，所以这步会出奇地顺。

**Phase D 验收**：

1. 一个 tab 内点 doc A → doc B → 浏览器后退，回到 doc A（tab 内历史生效）。
2. 刷新页面，URL 能恢复到当前 view 的 location。
3.（可选）split 两个 view，各自导航互不影响。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/entities/view.ts        # history
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/view-root.tsx       # MemoryRouter
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/browser-adapter.ts  # push/replace 语义
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workbench/view/split-view/         # split
```

---

## Phase E：接入真正的文档模型（Yjs → BlockSuite）展望

到这里你已经有：Entity/Store/Scope 三件套、per-doc scope、update 流存储、per-view 路由。**现在才是接 Yjs / BlockSuite 的正确时机**——上一份教程明确推迟它，是对的，因为没有上面这些地基，编辑器会无处安放。

Karpathy 式拆法，别一步到位：

### E1. 先用 Yjs 表示 content（最小 CRDT）

把 `Doc.content$` 背后从普通 string 换成 `Y.Text`：

- 装 `yjs`。
- `Doc` 持有一个 `Y.Doc`，`content` 来自 `ydoc.getText("content")`。
- `pushDocUpdate` 的 `data` 从 JSON snapshot 换成 `Y.encodeStateAsUpdate(ydoc)`（`Uint8Array`）。
- `DocFrontend.connect` 改成：加载已有 update → `Y.applyUpdate`；监听 `ydoc.on("update", ...)` → push。

这一步做完，你的 `SyncEngine` 就有理由长出真正的 diff（`Y.encodeStateVector` + `Y.diffUpdate`），多 tab/多 peer 合并不再是"后写覆盖"，而是 CRDT 合并。**这是整条主线里最 beautiful 的一跃**：存储层、同步层、文档层第一次真正咬合。

### E2. 再换成 BlockSuite editor

- 装 `@blocksuite/*`（参考 AFFiNE 的版本）。
- workspace 持有一个 BlockSuite collection（`WorkspaceImpl`），doc 从 collection 拿 `getStore({ id })`。
- 新增 `EditorScope` + `EditorService` + `Editor` entity，`editor.bindEditorContainer(<affine-editor-container>)`。
- doc 页面渲染 `<affine-editor-container>`，`onLoad` 时绑定。

对照 AFFiNE：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/entities/workspace.ts   # docCollection
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/editor/entities/editor.ts          # bindEditorContainer
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/desktop/pages/workspace/detail-page/
```

> E2 是个大工程，建议作为本阶段的"毕业项目"，单独开一轮。E1（Yjs）才是必须先做的——它把你前面所有抽象的价值兑现。我不确定你需要多完整的 BlockSuite（它本身是另一个巨型项目），但**只要 E1 做了，你对 AFFiNE 主线的理解就完整了**：剩下的都是把玩具版换成生产版。

---

## 再读 AFFiNE：本阶段阅读清单

沿用上一份的纪律——每次只带一个问题，读完用摘要模板写出来，写不出就回来补更小的玩具版。本阶段新增的问题：

| 问题 | 先读 |
| --- | --- |
| Service / Entity / Store 怎么区分 | `packages/common/infra/src/framework/core/components/{service,entity,store}.ts` |
| createEntity 为什么不缓存 | `packages/common/infra/src/framework/core/provider.ts` |
| scope 注册怎么声明式切换 | `packages/frontend/core/src/modules/doc/index.ts`（`.scope().entity()`） |
| doc open 的引用计数 | `packages/frontend/core/src/modules/doc/services/docs.ts` |
| DocStorage 的 update 接口 | `packages/common/nbstore/src/storage/doc.ts` |
| DocFrontend 怎么连 Yjs 和存储 | `packages/common/nbstore/src/frontend/doc.ts` |
| Sync 的多 peer 与 state$ | `packages/common/nbstore/src/sync/index.ts` |
| subscribe 型 RPC 怎么实现 | `packages/common/infra/src/op/{client,consumer}.ts` |
| View 的 history 栈 | `packages/frontend/core/src/modules/workbench/entities/view.ts` |
| per-view MemoryRouter | `packages/frontend/core/src/modules/workbench/view/view-root.tsx` |

---

## 推荐提交顺序

每个提交独立可跑（`pnpm typecheck` + `pnpm malphite web dev`）。

```text
A1  修 WorkspacesService.get 的 find bug
A2  Framework 增加 entity() / createEntity() / 逆序 dispose
A3  View 改为 entity（createEntity 创建）
A4  新增 DocStore，DocService 改为依赖 DocStore
A5  workspace 内注册改为 configureXxxModule 声明式（行为不变）
B1  新增 DocScope + Doc entity
B2  新增 ObjectPool + DocsService.open（引用计数）
B3  页面用 useDocScope open/release
C1  DocStorage 接口改为 update-based（getDoc/pushDocUpdate/subscribe）
C2  worker RPC 增加 subscribe 型消息（服务端推送）
C3  新增 DocFrontend
C4  新增 toy SyncEngine + state$，UI 显示同步状态
D1  View 增加 history 栈（push/replace/back/forward）
D2  browser adapter 升级 push/replace 语义
D3  ViewRoot 改用 per-view MemoryRouter
D4  （可选）split view
E1  content 改为 Y.Text，存储改存 Yjs update，SyncEngine 长出 diff
E2  （毕业项目，单独开轮）接入 BlockSuite editor
```

关键：A、C、E1 各自不要和别的混在一个提交里。A 是 DI 地基，C 是存储模型换血，E1 是 CRDT 接入——任何一个出问题都要能单独二分定位。

---

## 抽象判断标准（沿用 + 本阶段补充）

上一份的 6 条仍然有效。本阶段再加 3 条专门针对"实体化"的判断——**满足才抽，不满足就先别**：

7. **同一类对象需要同时存在多个、各有生命周期** → 才升级成 Entity（否则留作 Service）。
8. **同一份数据有第二个读写入口，或读写方式即将变化**（如从快照变 update 流）→ 才抽 Store。
9. **某段状态需要"只属于这一个 doc / 这一个 view"** → 才开新 scope（否则放在上层 scope 即可）。

仍然**暂时不要**：cloud sync 的真实 diff/merge（E1 之前都别碰）、SharedWorker fallback 矩阵、telemetry、i18n、权限/分享、self-hosted 多 server。这些是 AFFiNE 必需，但不是你理解主线必需。

---

## 完成本阶段后你会在哪

把 A–D + E1 做完，按 0.1 的加权口径重新估：

| 层 | 做完后估算 | 变化 |
| --- | --- | --- |
| Framework / DI | ~60% | +25（Entity/Store/声明式 scope） |
| LiveData | ~30% | 不变（本阶段没动响应式） |
| Workspace | ~50% | +5（声明式注册） |
| Storage / nbstore | ~55% | +30（update 流 + DocFrontend + toy Sync + Yjs） |
| Workbench / View | ~65% | +25（history + memory router + split） |
| Doc / Editor | ~30% | +22（Doc entity + DocScope + Yjs content） |

加权合计 ≈ **55–60%**。也就是说，本阶段把你从"立了骨架"推到"长出主肌肉"。剩下的 40% 主要是 BlockSuite 全量接入（E2）、cloud flavour、真实 SyncEngine 多 peer、以及大量生产级细节——那些是"把玩具换成生产版"，不再是"理解主线"。

最重要的一句话，作为本阶段的指北针：

```text
单例 → 实体（可多实例、有生命周期）
逻辑里掏出数据访问（Store）
快照 → 更新流（update / 最终 Yjs CRDT）
单 path → 带历史的子路由
```

把这四样咬合好，你的 toy 就不再是"长得像 AFFiNE"，而是"用 AFFiNE 的方式在思考"。
