import type { FrameworkProvider } from "~/src/framework/framework";
import { ObjectPool, type PoolHandle } from "~/src/shared/object-pool";
import { DocEntity } from "./doc-entity";
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

    const handle = {
      doc: docEntity,
      provider: docProvider,
      dispose: () => docProvider.dispose(),
    };

    const pooled = this.pool.put(docId, handle);
    return { obj: handle, release: pooled.release };
  }
}
