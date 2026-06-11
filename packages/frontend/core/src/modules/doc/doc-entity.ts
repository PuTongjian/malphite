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
    // Phase C：改成 store.pushDocUpdate
  }

  dispose() {
    // Phase C：在这里断开 DocFrontend 订阅
  }
}
