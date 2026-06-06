import type { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import type { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { LiveData } from "~/src/shared/live-data";
import type { Doc } from "./doc-types";

export class DocService {
  docs$: LiveData<Doc[]>;

  constructor(
    private workspaceService: WorkspaceService,
    private storage: DocStorageService,
  ) {
    const stored = this.storage.load(this.workspaceService.id);
    this.docs$ = new LiveData(
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
