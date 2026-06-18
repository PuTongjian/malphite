# AFFiNE Style Next Teaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写下一篇 Phase 2 后续教学，并让当前 toy 项目完成 “C4 workspace engine 启动同步状态” 这一条可观察闭环。

**Architecture:** 下一篇教学先不进入 Yjs，而是把现有 `SyncEngine` 接进 workspace 生命周期：打开 workspace 时启动，关闭 workspace 时停止，workspace UI 内展示状态。然后补两个小债务：标题编辑同步回 All Docs 列表、清理 `DocEntity` 过期注释，让读者看清 `DocEntity -> DocFrontend -> DocStorage` 和 `DocService.docs$` 的边界。

**Tech Stack:** Markdown、TypeScript、React 19、React Router 7、自研 `Framework` DI、`LiveData`、IndexedDB、BroadcastChannel、AFFiNE `WorkspaceEngine` / `nbstore Sync` 架构参考。

---

## File Structure

**Create:**
- `packages/frontend/core/src/modules/workspace/workspace-engine.ts`：toy 版 workspace engine。它不做 Yjs、不做远端同步，只负责把 workspace 生命周期和 `SyncEngine.start()` / `stop()` 连起来。
- `docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md`：下一篇教学文档。它解释为什么 C4 不是一个孤立类，而应该被 workspace engine 启动。

**Modify:**
- `packages/frontend/core/src/modules/workspace/index.ts`：在 workspace scope 注册 `SyncEngine` 和 `WorkspaceEngine`。
- `packages/frontend/core/src/modules/workspace/workspaces-service.ts`：打开 workspace 后创建并启动 `WorkspaceEngine`。
- `packages/frontend/core/src/modules/workspace/workspace-ref.ts`：关闭 workspace 时先停 engine，再 dispose provider。
- `packages/frontend/core/src/modules/storage/index.ts`：移除 root 级 `configureSyncEngineModule()`。
- `packages/frontend/core/src/modules/index.ts`：不再从 common modules 注册 `SyncEngine`。
- `packages/frontend/core/src/modules/workbench/workbench-root.tsx`：在 workspace UI 内展示 sync 状态。
- `packages/frontend/core/src/components/app-shell.tsx`：移除 root shell 里的 demo `SyncStatus`。
- `packages/frontend/core/src/modules/doc/doc-service.ts`：让 `rename()` 同步更新 `DocService.docs$`，标题持久化仍交给 `DocFrontend`。
- `packages/frontend/core/src/modules/doc/docs-service.ts`：把 `rename()` 代理给 `DocService`。
- `packages/frontend/core/src/pages/workspace/doc-page.tsx`：标题输入框同时调用 `doc.rename()` 和 `docsService.rename()`。
- `packages/frontend/core/src/modules/doc/doc-entity.ts`：删除过期注释，明确持久化由 `DocFrontend` 负责。

**Reference:**
- `docs/web-from-zero-to-affine-style-phase2-teaching-rewrite.md`：下一步顺序来源。
- `/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/entities/engine.ts`：真实 `WorkspaceEngine.start()` 对照。
- `/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/entities/workspace.ts`：真实 workspace 加载 doc 时连接 engine 的对照。
- `/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/sync/index.ts`：真实 sync orchestrator 对照。
- `/Users/malphite/Desktop/Archive/AFFiNE/packages/common/nbstore/src/frontend/doc.ts`：真实 `DocFrontend` 对照。

**Current Code Facts:**
- `DocFrontend` 已经实现，`doc-page.tsx` 里的 `<textarea>` 正文编辑也已经实现。
- `configureSyncEngineModule()` 和 root `AppShell` 里的 demo `SyncStatus` 已经存在，但 `SyncEngine.start()` 没有被调用。
- `AppShell` 在 root provider 下，不能作为 workspace-scoped `SyncEngine` 的长期展示位置。

---

### Task 1: Add WorkspaceEngine

**Files:**
- Create: `packages/frontend/core/src/modules/workspace/workspace-engine.ts`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Create `workspace-engine.ts`**

Create `packages/frontend/core/src/modules/workspace/workspace-engine.ts` with this complete content:

```ts
import type { SyncEngine } from "~/src/modules/storage/sync-engine";

export class WorkspaceEngine {
  private started = false;

  constructor(private sync: SyncEngine) {}

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.sync.start();
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

- [ ] **Step 2: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 3: Commit**

```bash
rtk git add packages/frontend/core/src/modules/workspace/workspace-engine.ts
rtk git commit -m "feat: add workspace engine shell"
```

---

### Task 2: Move SyncEngine Registration into Workspace Scope

**Files:**
- Modify: `packages/frontend/core/src/modules/workspace/index.ts`
- Modify: `packages/frontend/core/src/modules/index.ts`
- Modify: `packages/frontend/core/src/modules/storage/index.ts`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Replace `workspace/index.ts`**

Replace `packages/frontend/core/src/modules/workspace/index.ts` with this complete content:

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

- [ ] **Step 2: Replace `modules/index.ts`**

Replace `packages/frontend/core/src/modules/index.ts` with this complete content:

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

- [ ] **Step 3: Replace `storage/index.ts`**

Replace `packages/frontend/core/src/modules/storage/index.ts` with this complete content:

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

- [ ] **Step 4: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 5: Commit**

```bash
rtk git add packages/frontend/core/src/modules/workspace/index.ts packages/frontend/core/src/modules/index.ts packages/frontend/core/src/modules/storage/index.ts
rtk git commit -m "feat: scope sync engine to workspace"
```

---

### Task 3: Start and Stop the Engine with WorkspaceRef

**Files:**
- Modify: `packages/frontend/core/src/modules/workspace/workspaces-service.ts`
- Modify: `packages/frontend/core/src/modules/workspace/workspace-ref.ts`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Replace `workspace-ref.ts`**

Replace `packages/frontend/core/src/modules/workspace/workspace-ref.ts` with this complete content:

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

- [ ] **Step 2: Replace `workspaces-service.ts`**

Replace `packages/frontend/core/src/modules/workspace/workspaces-service.ts` with this complete content:

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

    const engine = provider.get(WorkspaceEngine);
    engine.start();

    return new WorkspaceRef(meta, provider, engine);
  }
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 4: Commit**

```bash
rtk git add packages/frontend/core/src/modules/workspace/workspaces-service.ts packages/frontend/core/src/modules/workspace/workspace-ref.ts
rtk git commit -m "feat: start workspace engine on open"
```

---

### Task 4: Show Sync State inside WorkbenchRoot

**Files:**
- Modify: `packages/frontend/core/src/components/app-shell.tsx`
- Modify: `packages/frontend/core/src/modules/workbench/workbench-root.tsx`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Replace `app-shell.tsx`**

Replace `packages/frontend/core/src/components/app-shell.tsx` with this complete content:

```tsx
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

- [ ] **Step 2: Replace `workbench-root.tsx`**

Replace `packages/frontend/core/src/modules/workbench/workbench-root.tsx` with this complete content:

```tsx
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

- [ ] **Step 3: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 4: Commit**

```bash
rtk git add packages/frontend/core/src/components/app-shell.tsx packages/frontend/core/src/modules/workbench/workbench-root.tsx
rtk git commit -m "feat: show sync status inside workspace"
```

---

### Task 5: Keep All Docs Title in Sync with Doc Edits

**Files:**
- Modify: `packages/frontend/core/src/modules/doc/doc-service.ts`
- Modify: `packages/frontend/core/src/modules/doc/docs-service.ts`
- Modify: `packages/frontend/core/src/pages/workspace/doc-page.tsx`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Replace `doc-service.ts`**

Replace `packages/frontend/core/src/modules/doc/doc-service.ts` with this complete content:

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

    void this.save([...this.docs$.value, doc]);

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

- [ ] **Step 2: Replace `docs-service.ts`**

Replace `packages/frontend/core/src/modules/doc/docs-service.ts` with this complete content:

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
      docEntity.content$.set(record.content);
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

- [ ] **Step 3: Replace `doc-page.tsx`**

Replace `packages/frontend/core/src/pages/workspace/doc-page.tsx` with this complete content:

```tsx
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

- [ ] **Step 4: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 5: Commit**

```bash
rtk git add packages/frontend/core/src/modules/doc/doc-service.ts packages/frontend/core/src/modules/doc/docs-service.ts packages/frontend/core/src/pages/workspace/doc-page.tsx
rtk git commit -m "fix: sync doc title edits to list"
```

---

### Task 6: Clean Up DocEntity Teaching Debt

**Files:**
- Modify: `packages/frontend/core/src/modules/doc/doc-entity.ts`
- Test: `rtk pnpm typecheck`

- [ ] **Step 1: Replace `doc-entity.ts`**

Replace `packages/frontend/core/src/modules/doc/doc-entity.ts` with this complete content:

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

- [ ] **Step 2: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 3: Commit**

```bash
rtk git add packages/frontend/core/src/modules/doc/doc-entity.ts
rtk git commit -m "docs: clarify doc entity boundary"
```

---

### Task 7: Write the Next Teaching Document

**Files:**
- Create: `docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md`
- Test: `rtk rg`

- [ ] **Step 1: Create `web-from-zero-to-affine-style-phase2-c4-workspace-engine.md`**

Create `docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md` with this complete content:

````markdown
# Phase 2 后续：把 C4 从 SyncEngine 文件变成 Workspace Engine 闭环

上一篇 `docs/web-from-zero-to-affine-style-phase2-teaching-rewrite.md` 已经把 Phase C 的主线讲清楚了：

- `DocStorageHandle` 是当前主存储入口。
- `DocStore` 是 workspace 内的过渡存储层。
- `DocFrontend` 负责把 `DocEntity` 的 LiveData 和 storage 接起来。
- `SyncEngine` 已经有状态机，但还没有真正进入 workspace 生命周期。

这一篇只做一件事：让 C4 变成闭环。

```text
open workspace
-> create workspace provider
-> create WorkspaceEngine
-> WorkspaceEngine.start()
-> SyncEngine.start()
-> WorkbenchRoot shows "Sync: synced"
```

真实 AFFiNE 里，类似位置在：

```text
/Users/malphite/Desktop/Archive/AFFiNE/packages/frontend/core/src/modules/workspace/entities/engine.ts
```

AFFiNE 的 `WorkspaceEngine.start()` 会打开 nbstore、启动 doc frontend、设置 root doc 优先级，并管理 blob/indexer/awareness。我们的 toy 版先只启动一个本地 `SyncEngine`。

## 1. 新增 WorkspaceEngine

创建文件：

```text
packages/frontend/core/src/modules/workspace/workspace-engine.ts
```

完整代码：

```ts
import type { SyncEngine } from "~/src/modules/storage/sync-engine";

export class WorkspaceEngine {
  private started = false;

  constructor(private sync: SyncEngine) {}

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.sync.start();
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

这段代码的重点不是复杂，而是边界：

- `SyncEngine` 描述同步状态。
- `WorkspaceEngine` 决定什么时候启动同步。
- `WorkspaceRef.dispose()` 决定什么时候停止同步。

## 2. 把 SyncEngine 注册到 workspace scope

替换文件：

```text
packages/frontend/core/src/modules/workspace/index.ts
```

完整代码：

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

注意这里没有把 `SyncEngine` 注册到 root common module。sync 是 workspace 级生命周期，不是浏览器 root 生命周期。

## 3. 从 common module 移除 SyncEngine 注册

替换文件：

```text
packages/frontend/core/src/modules/index.ts
```

完整代码：

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

替换文件：

```text
packages/frontend/core/src/modules/storage/index.ts
```

完整代码：

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

## 4. 打开 workspace 时启动 engine

替换文件：

```text
packages/frontend/core/src/modules/workspace/workspaces-service.ts
```

完整代码：

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

    const engine = provider.get(WorkspaceEngine);
    engine.start();

    return new WorkspaceRef(meta, provider, engine);
  }
}
```

以前 `open()` 只创建 provider。现在 `open()` 还启动这个 workspace 的数据引擎。

## 5. 关闭 workspace 时停止 engine

替换文件：

```text
packages/frontend/core/src/modules/workspace/workspace-ref.ts
```

完整代码：

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

`useWorkspaceScope()` 里已经有 cleanup：

```ts
return () => {
  ref.dispose();
  setWorkspaceRef(null);
};
```

所以只要 `WorkspaceRef.dispose()` 停 engine，React unmount workspace 时就会跟着停。

## 6. 把同步状态显示放到 WorkbenchRoot

root `AppShell` 不应该依赖 workspace 里的 `SyncEngine`。先把它改回只负责外壳。

替换文件：

```text
packages/frontend/core/src/components/app-shell.tsx
```

完整代码：

```tsx
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

然后把 sync 状态放到 workspace 内的 `WorkbenchRoot`。

替换文件：

```text
packages/frontend/core/src/modules/workbench/workbench-root.tsx
```

完整代码：

```tsx
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

打开 workspace 后，你应该能看到：

```text
Sync: synced
```

这是因为当前 toy `SyncEngine.start()` 很简单：

```ts
start() {
  this.state$.set("syncing");
  this.state$.set("synced");
}
```

它不是远端同步，只是一个 local-only 状态闭环。

## 7. 顺手修标题列表同步

现在正文 textarea 已经能编辑了，但标题还有一个教学债：doc 页面改标题后，All Docs 列表可能还读旧的 `DocService.docs$`。

替换文件：

```text
packages/frontend/core/src/modules/doc/doc-service.ts
```

完整代码：

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

    void this.save([...this.docs$.value, doc]);

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

替换文件：

```text
packages/frontend/core/src/modules/doc/docs-service.ts
```

完整代码：

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
      docEntity.content$.set(record.content);
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

替换文件：

```text
packages/frontend/core/src/pages/workspace/doc-page.tsx
```

完整代码：

```tsx
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

这里不让 `DocService.rename()` 写 storage。标题已经由 `doc.rename()` 改进 `DocEntity.title$`，再由 `DocFrontend` 订阅并写入 `DocStorage`。`DocService.rename()` 只负责让 All Docs 列表立刻显示新标题。

## 8. 清理 DocEntity 过期注释

替换文件：

```text
packages/frontend/core/src/modules/doc/doc-entity.ts
```

完整代码：

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

`DocEntity` 不再直接写 storage。它只维护内存里的响应式状态，`DocFrontend.connect(doc)` 会订阅这些状态并推给 `DocStorage`。

## 9. 验收

先跑类型检查：

```bash
rtk pnpm typecheck
```

预期：

```text
TypeScript build passes.
```

再启动开发服务：

```bash
rtk pnpm --filter @mlphite/web dev
```

打开：

```text
http://localhost:5173/workspace/local
```

验收 1：workspace header 应显示：

```text
Sync: synced
```

验收 2：打开 Welcome 文档，把标题改成：

```text
Welcome Edited
```

回到 All Docs，列表应该显示：

```text
Welcome Edited
```

验收 3：在正文 textarea 输入任意文本，刷新页面后再打开同一篇 doc，正文应该保留。

## 10. 这一篇和 AFFiNE 的对应关系

| toy 项目 | AFFiNE |
| --- | --- |
| `WorkspaceEngine.start()` | `packages/frontend/core/src/modules/workspace/entities/engine.ts` 里的 `WorkspaceEngine.start()` |
| `SyncEngine.start()` | `packages/common/nbstore/src/sync/index.ts` 里的 `Sync.start()` |
| `DocFrontend.connect(doc)` | `packages/common/nbstore/src/frontend/doc.ts` 里的 `DocFrontend.connectDoc()` |
| `DocsService.open()` 创建 per-doc scope | `packages/frontend/core/src/modules/doc/services/docs.ts` 的 doc lifecycle/object pool 思路 |

完成这一篇之后，C4 才从“有一个 sync 文件”变成“打开 workspace 时有一个启动的数据引擎”。下一步再进入 Phase D：把 `ViewRoot` 的手写 path 分支改成 per-view memory router，或者进入 Phase E：把 JSON `{ title, content }` 替换成 Yjs update。
````

- [ ] **Step 2: Verify the teaching document includes the key paths**

Run:

```bash
rtk rg "workspace-engine|workspaces-service|workspace-ref|workbench-root|docs-service|doc-page|doc-entity|Sync: synced" docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md
```

Expected: all listed file names and `Sync: synced` appear.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md
rtk git commit -m "docs: add workspace engine teaching chapter"
```

---

### Task 8: Final Verification

**Files:**
- Verify: all modified files
- Verify: `docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md`

- [ ] **Step 1: Search for accidental placeholder text**

Run:

```bash
rtk rg "TBD|implement later|fill in details|占位" docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md packages/frontend/core/src/modules/workspace packages/frontend/core/src/modules/doc packages/frontend/core/src/modules/workbench packages/frontend/core/src/components/app-shell.tsx
```

Expected: no matches.

- [ ] **Step 2: Run typecheck**

Run:

```bash
rtk pnpm typecheck
```

Expected:

```text
TypeScript build passes.
```

- [ ] **Step 3: Run manual browser verification**

Run:

```bash
rtk pnpm --filter @mlphite/web dev
```

Open:

```text
http://localhost:5173/workspace/local
```

Verify:

```text
1. Sync status is visible in workspace UI.
2. Sync status reads "Sync: synced".
3. Editing doc title updates the All Docs list.
4. Editing textarea content persists after reload.
```

- [ ] **Step 4: Review spec coverage**

Confirm:

```markdown
- C4 has DI registration in workspace scope.
- C4 has `start()` called from workspace open.
- C4 has `stop()` called from workspace dispose.
- C4 has visible UI state.
- Existing textarea content editing is preserved.
- All Docs title consistency has a minimal teaching fix.
- `DocEntity` no longer claims it writes storage directly.
- The teaching document includes full copy-paste code.
- The teaching document references AFFiNE only for architecture comparison.
```

- [ ] **Step 5: Report result**

Use this completion format:

```markdown
Implemented the next teaching chapter and the C4 workspace engine closure.

Verification:
- `rtk pnpm typecheck`: passed
- Manual browser check at `http://localhost:5173/workspace/local`: `Sync: synced`, title sync, content persistence verified

Files changed:
- `packages/frontend/core/src/modules/workspace/workspace-engine.ts`
- `packages/frontend/core/src/modules/workspace/index.ts`
- `packages/frontend/core/src/modules/workspace/workspaces-service.ts`
- `packages/frontend/core/src/modules/workspace/workspace-ref.ts`
- `packages/frontend/core/src/modules/storage/index.ts`
- `packages/frontend/core/src/modules/index.ts`
- `packages/frontend/core/src/components/app-shell.tsx`
- `packages/frontend/core/src/modules/workbench/workbench-root.tsx`
- `packages/frontend/core/src/modules/doc/doc-service.ts`
- `packages/frontend/core/src/modules/doc/docs-service.ts`
- `packages/frontend/core/src/pages/workspace/doc-page.tsx`
- `packages/frontend/core/src/modules/doc/doc-entity.ts`
- `docs/web-from-zero-to-affine-style-phase2-c4-workspace-engine.md`
```

---

## Self-Review Notes

Spec coverage:
- The plan follows the next-step order from `docs/web-from-zero-to-affine-style-phase2-teaching-rewrite.md`.
- It uses current code reality: `DocFrontend` and textarea content editing already exist; `SyncEngine.start()` does not run yet.
- It includes full code for each changed source file and for the next teaching document.
- It references `/Users/malphite/Desktop/Archive/AFFiNE` only to explain architecture boundaries.

Placeholder scan:
- No placeholder implementation steps are present.
- Every code-changing step contains complete replacement code.

Type consistency:
- `WorkspaceEngine` is imported from `./workspace-engine` everywhere.
- `WorkspaceRef` constructor and `WorkspacesService.open()` agree on `(meta, provider, engine)`.
- `SyncEngine` is provided inside workspace scope and consumed by `WorkbenchRoot` inside the workspace provider.
- `DocsService.rename()` delegates to `DocService.rename()`.
- `doc-page.tsx` calls `doc.rename()` for persistence through `DocFrontend` and `docsService.rename()` for list display.
