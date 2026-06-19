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
