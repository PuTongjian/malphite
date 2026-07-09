import type {
  DocMetaRecord,
  DocStorage,
  DocUpdateRecord,
} from "~/src/modules/storage/doc-storage";

export class DocStore {
  constructor(
    private storage: DocStorage,
    private workspaceId: string,
  ) {}

  async getDocUpdates(docId: string): Promise<DocUpdateRecord[]> {
    return this.storage.getDocUpdates(docId);
  }

  async getDocUpdatesAfter(docId: string, clock: number) {
    return this.storage.getDocUpdatesAfter(docId, clock);
  }

  async pushDocUpdate(docId: string, update: Uint8Array) {
    return this.storage.pushDocUpdate(docId, update);
  }

  subscribeDocUpdate(callback: (docId: string) => void) {
    return this.storage.subscribeDocUpdate(callback);
  }

  async loadList(): Promise<DocMetaRecord[]> {
    return this.storage.getDocList(this.workspaceId);
  }

  async setDocList(docs: DocMetaRecord[]) {
    await this.storage.setDocList(this.workspaceId, docs);
  }
}
