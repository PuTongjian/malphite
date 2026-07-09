import type { FrameworkProvider } from "~/src/framework/framework";
import type { SimpleSyncPeer } from "~/src/modules/storage/simple-sync-peer";
import { ObjectPool, type PoolHandle } from "~/src/shared/object-pool";
import { DocEntity } from "./doc-entity";
import type { DocFrontend } from "./doc-frontend";
import { DocScope } from "./doc-scope";
import type { DocService } from "./doc-service";

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
    private syncPeer: SimpleSyncPeer,
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
          return new DocEntity(_provider.get(DocScope));
        });
    });

    const record = this.listService.get(docId);
    const docEntity = docProvider.createEntity(DocEntity, undefined as never);
    const disconnect = this.docFrontend.connect(docEntity);

    if (record) {
      docEntity.title$.set(record.title);
    }

    void this.syncPeer.syncDoc(docId);

    const handle = {
      doc: docEntity,
      provider: docProvider,
      dispose: () => {
        disconnect();
        docEntity.dispose();
        docProvider.dispose();
      },
    };

    const pooled = this.pool.put(docId, handle);
    return { obj: handle, release: pooled.release };
  }
}
