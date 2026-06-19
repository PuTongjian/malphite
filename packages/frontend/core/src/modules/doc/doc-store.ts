import type {
  DocRecordData,
  DocStorage,
} from "~/src/modules/storage/doc-storage";
import type { Doc } from "./doc-types";

export class DocStore {
  constructor(
    private storage: DocStorage,
    private workspaceId: string,
  ) {}

  async getDoc(docId: string) {
    return this.storage.getDoc(docId);
  }

  async pushDocUpdate(docId: string, data: DocRecordData) {
    await this.storage.pushDocUpdate(docId, data);
  }
  subscribeDocUpdate(callback: (docId: string) => void) {
    return this.storage.subscribeDocUpdate(callback);
  }

  async listDocIds() {
    return this.storage.getDocList(this.workspaceId);
  }

  async load(workspaceId: string): Promise<Doc[]> {
    const ids = await this.storage.getDocList(workspaceId);
    const docs: Doc[] = [];

    for (const id of ids) {
      const record = await this.storage.getDoc(id);
      if (record) {
        docs.push({
          id: record.docId,
          title: record.data.title,
          content: record.data.content,
        });
      }
    }

    return docs;
  }

  async save(workspaceId: string, docs: Doc[]): Promise<void> {
    for (const doc of docs) {
      await this.storage.pushDocUpdate(doc.id, {
        title: doc.title,
        content: doc.content,
      });
    }

    this.setDocList(workspaceId, docs);
  }

  async setDocList(workspaceId: string, docs: Doc[]): Promise<void> {
    await this.storage.setDocList(
      workspaceId,
      docs.map((doc) => doc.id),
    );
  }
}
