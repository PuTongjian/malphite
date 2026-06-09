import type { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import type { Doc } from "./doc-types";

export class DocStore {
  constructor(private storage: DocStorageService) {}

  load(workspaceId: string): Promise<Doc[]> {
    return this.storage.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]): Promise<void> {
    return this.storage.save(workspaceId, docs);
  }
}
