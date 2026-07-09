import { LiveData } from "~/src/shared/live-data";
import type { DocStore } from "./doc-store";
import type { Doc } from "./doc-types";

function createWelcomeDoc(): Doc {
  return {
    id: "welcome",
    title: "Welcome",
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class DocService {
  docs$ = new LiveData<Doc[]>([]);
  error$ = new LiveData<Error | null>(null);
  ready$ = new LiveData(false);

  constructor(private storage: DocStore) {
    void this.load();
  }

  create(title: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title,
    };

    const nextDocs = [...this.docs$.value, doc];
    this.docs$.set(nextDocs);
    this.error$.set(null);

    void this.saveList(nextDocs);

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
    void this.saveList(nextDocs);
  }

  get(id: string) {
    return this.docs$.value.find((doc) => doc.id === id);
  }

  private async load() {
    this.error$.set(null);

    try {
      const stored = await this.storage.loadList();
      this.docs$.set(stored.length > 0 ? stored : [createWelcomeDoc()]);
      this.ready$.set(true);
    } catch (error) {
      this.error$.set(toError(error));
    }
  }

  private async saveList(docs: Doc[]) {
    try {
      await this.storage.setDocList(docs);
    } catch (error) {
      this.error$.set(toError(error));
    }
  }
}
