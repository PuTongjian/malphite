import type * as Y from "yjs";
import { LiveData } from "~/src/shared/live-data";
import type { DocScope } from "./doc-scope";
import {
  createEmptyToyYDoc,
  readToyDocFields,
  writeToyDocFields,
} from "./yjs-doc-codec";

export class DocEntity {
  readonly ydoc: Y.Doc;
  readonly title$ = new LiveData("");
  readonly content$ = new LiveData("");

  private applyingYjs = false;
  private disposed = false;

  private readonly handleYDocUpdate = () => {
    if (this.applyingYjs) {
      return;
    }

    this.syncLiveDataFromYDoc();
  };

  constructor(public readonly scope: DocScope) {
    this.ydoc = createEmptyToyYDoc();
    this.syncLiveDataFromYDoc();

    this.ydoc.on("update", this.handleYDocUpdate);
  }

  get id() {
    return this.scope.docId;
  }

  rename(title: string) {
    this.title$.set(title);
    this.writeLiveDataToYDoc();
  }

  setContent(content: string) {
    this.content$.set(content);
    this.writeLiveDataToYDoc();
  }

  seedTitleFromList(title: string) {
    this.title$.set(title);
  }

  applyRemoteUpdate(apply: () => void) {
    this.applyingYjs = true;
    try {
      apply();
      this.syncLiveDataFromYDoc();
    } finally {
      this.applyingYjs = false;
    }
  }

  dispose() {
    if (this.disposed) return;

    this.disposed = true;
    this.ydoc.off("update", this.handleYDocUpdate);
    this.ydoc.destroy();
  }

  private writeLiveDataToYDoc() {
    writeToyDocFields(this.ydoc, {
      title: this.title$.value,
      content: this.content$.value,
    });
  }

  private syncLiveDataFromYDoc() {
    const fields = readToyDocFields(this.ydoc);
    this.title$.set(fields.title);
    this.content$.set(fields.content);
  }
}
