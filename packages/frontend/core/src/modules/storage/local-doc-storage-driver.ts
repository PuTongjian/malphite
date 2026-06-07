import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageDriver } from "./doc-storage-service";

export class LocalDocStorageDriver implements DocStorageDriver {
  async load(workspaceId: string) {
    const raw = localStorage.getItem(`workspace:${workspaceId}:docs`);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  }

  async save(workspaceId: string, docs: Doc[]) {
    localStorage.setItem(`workspace:${workspaceId}:docs`, JSON.stringify(docs));
  }
}
