import type { DocMetaRecord, DocStorage, DocUpdateRecord } from "./doc-storage";

export class MemoryRemoteDocStorage implements DocStorage {
  private updates = new Map<string, DocUpdateRecord[]>();
  private lists = new Map<string, DocMetaRecord[]>();
  private subscribers = new Set<(docId: string) => void>();

  async getDocUpdates(docId: string) {
    return [...(this.updates.get(docId) ?? [])];
  }

  async getDocUpdatesAfter(docId: string, clock: number) {
    return (this.updates.get(docId) ?? []).filter((record) => {
      return record.clock > clock;
    });
  }

  async pushDocUpdate(docId: string, update: Uint8Array) {
    const records = this.updates.get(docId) ?? [];
    const record: DocUpdateRecord = {
      docId,
      update,
      clock: records.length + 1,
      timestamp: Date.now(),
    };

    this.updates.set(docId, [...records, record]);
    this.notify(docId);

    return record;
  }

  async getDocClock(docId: string) {
    return this.updates.get(docId)?.length ?? 0;
  }

  async getDocList(workspaceId: string) {
    return [...(this.lists.get(workspaceId) ?? [])];
  }

  async setDocList(workspaceId: string, docs: DocMetaRecord[]) {
    this.lists.set(workspaceId, [...docs]);
  }

  subscribeDocUpdate(callback: (docId: string) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(docId: string) {
    for (const subscriber of this.subscribers) {
      subscriber(docId);
    }
  }
}
