# 从玩具实现到 AFFiNE 思维：Phase 2 教学重写版

> 本文是 `web-from-zero-to-affine-style-phase2.md` 的教学重写版。
> 旧文档偏“给代码”，这份文档偏“解释为什么、指出问题、给出闭环”。

## 0. 阅读方式

这不是一份单纯的复制粘贴教程。它会先解释每个抽象为什么出现，再给出当前代码、遗留问题、AFFiNE 对照和下一步改法。

## 1. 当前代码已经走到哪里

| 阶段 | 当前状态 | 说明 |
| --- | --- | --- |
| Phase A：Entity / Store / 声明式注册 | 基本落地 | `Framework` 已有 `entity()` / `createEntity()`；workspace 内通过 `configureDocModule()`、`configureWorkbenchModule()` 注册模块。 |
| Phase B：DocScope / DocEntity / ObjectPool | 基本落地 | `DocsService.open()` 会创建 per-doc child provider，并通过 `ObjectPool` 做引用计数。 |
| Phase C1：update-based `DocStorage` 接口 | 已落地 | 当前仍用 JSON `{ title, content }` 模拟 update，真实 AFFiNE 用 Yjs `Uint8Array`。 |
| Phase C2：IndexedDB + BroadcastChannel | 已落地 | 主线程 `createIndexedDbDocStorage()` 维护 `doc-records` 和 `meta`，跨 tab 通过 BroadcastChannel 通知。 |
| Phase C3：`DocFrontend` | 已落地但有教学债 | 它负责本地 LiveData 到存储、存储通知回 LiveData 的双向桥接。 |
| Phase C4：`SyncEngine` | 未闭环 | 文件存在，但没有 DI 注册、没有 `start()` 调用、没有 UI 状态展示。 |
| Phase D：per-view history / MemoryRouter | 未开始 | `View` 仍主要是 `path$`，`ViewRoot` 仍手工按 path 分支渲染。 |

## 2. 先看一张系统图

```text
Root Framework
├── DocStorageHandle
│   └── createIndexedDbDocStorage()        # Phase C 主路径
├── DocStorageProvider / DocStorageService # Phase 1 legacy 路径，当前仍注册
├── SiteService
└── WorkspacesService
    └── WorkspaceScope
        ├── WorkspaceService
        ├── DocStore
        ├── DocFrontend
        ├── DocService                    # 文档列表
        ├── DocsService                   # 单 doc scope + pool
        │   └── DocScope(docId)
        │       └── DocEntity
        └── WorkbenchService
            └── View Entity
```

可以把这套结构想成三层：

第一层是 root，它只知道“这个浏览器环境里有哪些全局能力”，比如本地 IndexedDB 存储。

第二层是 workspace scope，它知道“当前打开的是哪个 workspace”，所以 `DocStore`、`DocService`、`WorkbenchService` 都挂在这里。

第三层是 doc scope，它只在打开某篇文档时创建。这样同一个 workspace 可以打开很多 doc，每个 doc 有自己的生命周期；关闭最后一个引用时，`ObjectPool` 才释放它。

## 3. 遗留代码与不合理边界审计

| 问题 | 具体位置 | 为什么不合理 | 改进教学 |
| --- | --- | --- | --- |
| 双存储栈并存 | `modules/index.ts`, `storage/index.ts`, `app.tsx` | Phase C 已经使用 `DocStorageHandle`，但 Phase 1 的 `DocStorageProvider` / `DocStorageService` / worker driver 仍被注册，读者会以为两条路径都在服务当前 doc 流。 | 先在文档里标成 legacy；后续单独做一次清理，把 worker 路径迁移为支持订阅的 worker frontend，或暂时从当前主线移除。 |
| C4 没有闭环 | `storage/sync-engine.ts` | 只有类定义，虽然有 `start()` 方法，但没有注册成 service，也没有任何地方调用 `start()` 或展示 UI 状态，因此它没有影响系统行为。 | 教学中要把它写成“状态机外壳”，并补一节说明怎样注册、启动和展示状态。 |
| 列表和单 doc 状态可能不同步 | `all-docs-page.tsx`, `doc-page.tsx` | 标题在 doc 页面通过 `DocEntity.rename()` 改，列表页仍读 `DocService.docs$`；如果列表没有同步更新，All Docs 会滞后。 | 解释这是“列表 meta”和“doc body”分离后的第一个一致性问题；AFFiNE 用 root YDoc meta 和 store watch 解决。 |
| content 不能编辑 | `doc-page.tsx` | `DocEntity.setContent()` 已存在，但页面只展示 `<p>`，没有输入控件，C3 的 content 同步很难手动验收。 | 教学中把它列为最小改进：加 `<textarea>` 调用 `doc.setContent()`。 |
| 过期注释和空生命周期 | `doc-entity.ts` | 注释还写“Phase C：改成 store.pushDocUpdate”，但当前实际由 `DocFrontend` 推送；`dispose()` 为空也没有说明为什么。 | 文档要解释“现在不是 Entity 直接写 store，而是 DocFrontend 订阅 Entity”；空 dispose 是 toy 简化。 |
| README 过时 | `README.md` | 仍说 core 是空壳，和当前前端核心实现不一致。 | 新教程里点名这是文档债；不在本次主文档里修 README，避免范围膨胀。 |

这里的重点不是“把所有 legacy 代码立刻删掉”，而是先画出哪条路径是当前主线。学习架构时最怕两件事：一是死代码看起来像活代码，二是过渡代码没有标注。Phase C 的教学应该把当前主线明确为 `DocStorageHandle -> DocStore / DocFrontend -> DocEntity`，把 `DocStorageService -> Driver -> Worker` 标成 Phase 1 legacy。

## 4. AFFiNE 真实架构对照

| 概念 | 当前 toy 项目 | AFFiNE 真实位置 | 差异 |
| --- | --- | --- | --- |
| 存储接口 | `DocStorage` | `packages/common/nbstore/src/storage/doc.ts` | toy 用 `{ title, content }`；AFFiNE 用 Yjs binary update、state vector 和 diff。 |
| IndexedDB 实现 | `createIndexedDbDocStorage()` | `packages/common/nbstore/src/impls/idb/doc.ts` | toy 有 `doc-records` 和 `meta`；AFFiNE 有 updates、snapshots、clocks。 |
| Entity 到存储的桥 | `DocFrontend` | `packages/common/nbstore/src/frontend/doc.ts` | toy 订阅 LiveData；AFFiNE 连接 Y.Doc。 |
| 同步引擎 | `SyncEngine` | `packages/common/nbstore/src/sync/index.ts` | toy 只有 local-only 状态；AFFiNE 聚合 doc/blob/awareness/indexer sync。 |
| 启动编排 | 暂时分散在 `packages/frontend/app/web/src/app.tsx` 和 `packages/frontend/core/src/modules/doc/docs-service.ts` | `packages/frontend/core/src/modules/workspace/entities/engine.ts` 和 `packages/frontend/core/src/modules/workspace/entities/workspace.ts` | AFFiNE 由 `WorkspaceEngine` open store/start frontend，再由 `Workspace` 的 `onLoadDoc` 把 Y.Doc 接到 `engine.doc.connectDoc()`。 |
| doc 生命周期 | `DocsService` + `ObjectPool` | `packages/frontend/core/src/modules/doc/services/docs.ts` | 两者思路接近，toy 版本更小。 |

如果用一个很朴素的心智模型理解：`DocStorage` 是硬盘接口，`DocFrontend` 是把内存里的文档对象和硬盘同步的驱动，`SyncEngine` 是未来负责把本地硬盘和远端硬盘对账的人。现在 toy 项目的问题是，硬盘接口和驱动已经有了，但对账的人还只是站在门口说了一句“我准备好了”，没有真正开始工作。

## 5. C1：从整包快照到按 doc 的存储接口

Phase 1 的模型是“每次保存整个 workspace 的 `Doc[]`”。这对于早期教程很好，因为简单。但一旦进入 AFFiNE 风格，它会立刻卡住：

1. 打开一篇文档时，不应该为了它读写整个 workspace。
2. 两个 tab 改不同文档时，整包覆盖会互相影响。
3. 未来接 Yjs 时，真正持久化的是 update 流，不是一份 JSON 数组。

所以 C1 的目标不是“换一个接口名字”，而是把存储的最小单位从 workspace 变成 doc。

```ts
export type DocRecordData = {
  title: string;
  content: string;
};

export type DocRecord = {
  docId: string;
  data: DocRecordData;
  timestamp: number;
};

export interface DocStorage {
  getDoc(docId: string): Promise<DocRecord | null>;
  pushDocUpdate(docId: string, data: DocRecordData): Promise<void>;
  getDocList(workspaceId: string): Promise<string[]>;
  setDocList(workspaceId: string, docIds: string[]): Promise<void>;
  subscribeDocUpdate(callback: (docId: string) => void): () => void;
}

export class DocStorageHandle {
  constructor(public readonly storage: DocStorage) {}
}
```

`DocStore` 是过渡层。它一边暴露 `getDoc()` / `pushDocUpdate()` 这种按 doc 的新接口，一边保留 `load()` / `save()` 给 `DocService` 的列表逻辑继续使用。

这不是最终形态，但它是一个很好的迁移姿势：不要在一步里同时重写列表、文档实体、存储和 UI。先让旧列表 API 能跑在新存储上，再逐步把真正的单文档编辑迁到 update 流。

AFFiNE 里这层会更复杂：文档内容是 Yjs update，列表 meta 也不是 `setDocList()` 这种手写数组，而是存进 root YDoc 的 metadata。toy 项目保留 `setDocList()` 是为了让读者先看清“文档内容”和“文档列表”是两个问题。

## 6. C2：IndexedDB 与跨 tab update 通知

C2 最容易误解的地方是：为什么明明 Phase 1 做了 worker IndexedDB，Phase C 又把 doc 存储放回主线程？

原因是 Phase 1 的 worker RPC 只有“主线程问，worker 答”的请求响应模型。C3 需要 `subscribeDocUpdate()`，也就是存储层主动通知前端“某篇 doc 变了”。如果继续放在 worker 里，就要先设计 worker -> main 的订阅通道。为了教学不同时引入两个复杂度，Phase C 先把 doc update 存储放回主线程。

当前 toy schema 有三个重点：

| Store | Key | Value | 用途 |
| --- | --- | --- | --- |
| `doc-records` | `docId` | `DocRecord` | 存单篇文档的最新快照。 |
| `meta` | `workspaceId` | `{ workspaceId, docIds }` | 存 workspace 下有哪些 doc。 |
| `docs` | `workspaceId` | `Doc[]` | Phase 1 legacy，只为了旧 worker 编译路径保留。 |

`BroadcastChannel` 解决的是跨 tab 通知。同一个 tab 内的订阅者可以用模块级 `Set` 通知；另一个浏览器 tab 里的 JS runtime 有自己的内存，收不到这个 `Set`。所以写入时需要同时做两件事：

1. 调本 runtime 的 subscriber。
2. `channel.postMessage({ docId })` 通知其它 tab。

这和 AFFiNE 的方向一致，只是 AFFiNE 的消息携带的是 Yjs update 相关状态，而不是 toy 的 JSON 快照。

`app.tsx` 里现在有两条线：

```ts
framework.service(DocStorageHandle, () => {
  return new DocStorageHandle(createIndexedDbDocStorage());
});

configureCommonModules(framework);
configureBrowserDocStorageModules(
  framework,
  new WorkerDocStorageDriver(worker),
);
```

第一条是 Phase C 主线。第二条是 Phase 1 legacy 线。文档必须明确这一点，否则读者会以为当前 doc 编辑同时经过了 worker 和主线程 IndexedDB。

## 7. C3：DocFrontend 如何把 Entity 和存储接起来

`DocEntity` 是内存里的文档。`DocStorage` 是硬盘接口。中间需要一个东西负责同步，这就是 `DocFrontend`。

如果让 `DocEntity.rename()` 直接写 storage，它会变成“业务对象 + 持久化对象”的混合体。AFFiNE 不这样做。真实系统里 doc 是 Y.Doc / BlockSuite store，持久化和同步由 nbstore frontend 处理。toy 项目用 `DocFrontend` 模拟这个边界。

`DocFrontend.connect(doc)` 做三件事：

1. 初次打开：`storage.getDoc(doc.id)`，把已有记录灌进 `doc.title$` 和 `doc.content$`。
2. storage 通知：订阅 `storage.subscribeDocUpdate()`，其它 tab 的 BroadcastChannel 通知和同 runtime `pushDocUpdate()` 后的本地 notify 都会触发回读并 apply；本地写入后的通知会形成一次回读回声。
3. 本地更新：订阅 `doc.title$` / `doc.content$`，用户编辑后 `pushDocUpdate()`。

```ts
import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    let applyingRemote = false;

    const applyRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      doc.title$.set(record.data.title);
      doc.content$.set(record.data.content);
      applyingRemote = false;
    };

    void this.storage.getDoc(doc.id).then((record) => {
      if (record) applyRecord(record);
    });

    const unsubscribeRemote = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((record) => {
        if (record) applyRecord(record);
      });
    });

    let pushing = false;
    let dirty = false;

    const push = () => {
      if (applyingRemote) return;
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

三个小变量分别解决三个真实问题：

| 变量 | 解决的问题 |
| --- | --- |
| `applyingRemote` | 从 storage apply 回来的数据会触发 LiveData 订阅，如果不跳过，就会形成“storage 通知 -> 本地 set -> 又 push 回 storage”的回声。 |
| `pushing` | 只在单个 `DocFrontend.connect()` 实例内串行化本地 push，避免同一个连接里把多次本地写入并发发给 storage；它不提供跨 tab 锁、冲突解决或全局一致性。 |
| `dirty` | 只在当前实例已有 push 进行时记录“期间又发生过新编辑”，等这次 push 完成后再补推一次；它不处理失败重试，也不保证多个 runtime 之间的最后状态合并。 |

当前 C3 还不是完全闭环：

1. `doc-page.tsx` 只能改标题，不能改正文，因此 `content$` 的同步缺少 UI 验收入口。
2. `DocEntity` 里 `_store` 参数没有使用，说明迁移后 Entity 不再直接写 store，这个构造参数可以在后续清理。
3. `DocEntity.dispose()` 为空，因为真正的 disconnect 被放在 `DocsService.open()` 的 handle dispose 里。
4. `AllDocsPage` 读的是 `DocService.docs$`，doc 页面改标题后列表未必同步，这是列表 meta 和单 doc entity 分离后的第一个一致性问题。
5. JSON 快照仍是 last-write-wins，没有版本向量、diff、冲突合并、错误状态和重试队列。

C3 只解决 Entity 与本地 `DocStorage` 的桥接。C4 才应该继续处理启动编排、sync 状态、错误展示，以及未来接入远端同步时需要的生命周期。

## 8. C4：SyncEngine 为什么现在还不算闭环

当前 `SyncEngine` 是一个很好的教学占位，但还不是功能。原因很简单：没人创建它，没人启动它，也没人读取它的状态。

现在的文件只定义了这个状态机：

```ts
import { LiveData } from "~/src/shared/live-data";
import type { DocStorage } from "./doc-storage";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export class SyncEngine {
  state$ = new LiveData<SyncState>("idle");
  error$ = new LiveData<Error | null>(null);

  constructor(local: DocStorage) {
    void local;
  }

  start() {
    this.state$.set("syncing");
    this.state$.set("synced");
  }

  stop() {
    this.state$.set("idle");
  }
}
```

要让它成为闭环，至少还缺三步：

1. 在某个 module configure 函数里注册 `SyncEngine` service。
2. 在 workspace 打开后调用 `sync.start()`。
3. 在 UI 里订阅 `sync.state$`，让用户能看到同步状态。

下面这段不是当前仓库已经实现的代码，而是教学用的建议接线。一个最小教学版可以长这样：

```ts
// packages/frontend/core/src/modules/storage/sync-engine-module.ts
import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "./doc-storage";
import { SyncEngine } from "./sync-engine";

export function configureSyncEngineModule(framework: Framework) {
  framework.service(SyncEngine, (provider) => {
    return new SyncEngine(provider.get(DocStorageHandle).storage);
  });
}
```

```tsx
// 可放在 AppShell 或 AllDocsPage 里展示
import { useService } from "~/src/framework/react";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { useLiveData } from "~/src/shared/use-live-data";

function SyncStatus() {
  const sync = useService(SyncEngine);
  const state = useLiveData(sync.state$);
  return <span>Sync: {state}</span>;
}
```

AFFiNE 里更接近 C4 的不是一个孤立的 `SyncEngine` 文件，而是 `nbstore/src/sync/index.ts` 里的 `Sync`，再往下有 doc/blob/awareness/indexer 的 sync frontend。真正的启动点更接近 `WorkspaceEngine.start()`：它负责 open store 和 start frontend；具体 doc 的接入则由 `Workspace` 的 `onLoadDoc` 把 Y.Doc 连接到 `engine.doc.connectDoc()`。

所以 toy 项目下一步更 AFFiNE 的方向是：把 `DocFrontend` 和 `SyncEngine` 从“某个页面打开 doc 时顺便 connect”提升为 workspace engine 统一编排。

第 9 节会把这些缺口整理成更具体的改进顺序：先注册 service，再启动 sync，再展示 UI 状态，最后把这些生命周期提升到 workspace engine 里统一编排。

## 9. 让当前代码更接近 AFFiNE 的改进教学

下面这些不是一次性全做的重构，而是从“当前 toy 项目”走向“AFFiNE 思维”的顺序。

| 顺序 | 改进 | 解决的问题 | 为什么更接近 AFFiNE |
| --- | --- | --- | --- |
| 1 | 标注并收束 legacy storage 栈 | 读者分不清当前主线和旧路径 | AFFiNE 的 storage/frontend/sync 边界清楚，不会让两套主路径长期并列。 |
| 2 | 给 `SyncEngine` 补 DI 注册、启动和 UI | C4 只有文件没有行为 | AFFiNE 的 sync 由 engine start，不是死类。 |
| 3 | 给 doc 页面补正文编辑 | C3 content 同步无法手动验收 | 真实编辑器的核心就是 doc 内容变更流。 |
| 4 | 修列表 meta 与 DocEntity 的一致性 | 改标题后 All Docs 可能滞后 | AFFiNE 把 doc meta 放在响应式 store/root YDoc 中。 |
| 5 | 把 `DocFrontend` 的位置解释清楚，后续可下沉到 storage/nbstore 层 | doc 模块直连 storage 容易混淆职责 | AFFiNE 的 `DocFrontend` 属于 nbstore frontend。 |
| 6 | Phase E 再引入 Yjs update | JSON 快照不是 CRDT | AFFiNE 的 doc 内容以 Yjs update 为核心。 |

### 9.1 最小闭环练习：让 content 真的可编辑

当前 `DocEntity.setContent()` 已经存在，`DocFrontend` 也已经订阅 `content$`，但页面没有触发它的 UI。最小补法是把 `doc-page.tsx` 的 `<p>` 换成：

```tsx
<textarea
  value={content}
  onChange={(event) => doc.setContent(event.target.value)}
/>
```

这个练习的意义不是 textarea，而是验证整条链路：

```text
textarea -> DocEntity.content$ -> DocFrontend.push()
-> IndexedDB doc-records -> BroadcastChannel
-> other tab DocFrontend.applyRecord()
-> other tab DocEntity.content$
```

### 9.2 最小闭环练习：让 C4 状态显示出来

如果 `SyncEngine` 只是一个文件，读者学不到系统设计。它必须有可观察行为。

最小闭环是：

1. 注册 `SyncEngine` service。
2. workspace 页面 mount 时调用 `start()`。
3. `AppShell` 或 `AllDocsPage` 展示 `Sync: synced`。

这一步完成后，C4 才从“代码存在”变成“系统里有一个同步状态源”。

不要在 C4 之前急着上 Yjs。Yjs 是下一阶段的正确方向，但如果 `DocStorage`、`DocFrontend`、`SyncEngine` 这三层边界还没讲清楚，引入 Yjs 只会把问题藏进二进制 update 里。先用 JSON 看清数据流，再把 `{ title, content }` 换成 `Uint8Array`，这就是从 scratch 到 library 的学习路径。

## 10. 验收清单与下一阶段

读完并按本文检查后，应该能回答这些问题：

- 当前 doc 数据到底走 `DocStorageHandle` 还是旧 worker driver？
- `DocStore` 和 `DocFrontend` 为什么不是同一个东西？
- 为什么 `DocFrontend` 需要 `applyingRemote`？
- 为什么 C4 现在还不算完成？
- 当前代码里哪些 legacy 路径应该标注或清理？
- 列表 meta 与单 doc entity 为什么可能出现一致性问题？
- toy 项目的 `DocStorage` 和 AFFiNE 的 `nbstore` 差在哪？
- 下一步要接近 AFFiNE，应该先补 SyncEngine 闭环还是先接 Yjs？

推荐下一阶段顺序：

1. 先标注并收束 legacy storage 栈。
2. 再让 C4 闭环：注册、启动、展示 `SyncEngine`。
3. 再补 doc 正文编辑，完整验证 C3 的 content update 流。
4. 再解决列表 meta 与单 doc entity 的一致性。
5. 再解释或下沉 `DocFrontend` 的位置，让它更接近 storage / nbstore frontend 边界。
6. 最后进入 Yjs，把 `DocRecordData` 从 JSON 快照换成 `Uint8Array` update。

本次只修改 Markdown，没有运行 TypeScript typecheck；真正改源码时才需要跑 `pnpm typecheck`。
