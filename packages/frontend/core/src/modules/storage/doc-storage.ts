export type DocUpdateRecord = {
  docId: string;
  update: Uint8Array;
  clock: number;
  timestamp: number;
};

export type DocMetaRecord = {
  id: string;
  title: string;
};

export interface DocStorage {
  getDocUpdates(docId: string): Promise<DocUpdateRecord[]>;
  getDocUpdatesAfter(docId: string, clock: number): Promise<DocUpdateRecord[]>;
  pushDocUpdate(docId: string, update: Uint8Array): Promise<DocUpdateRecord>;
  getDocClock(docId: string): Promise<number>;
  getDocList(workspaceId: string): Promise<DocMetaRecord[]>;
  setDocList(workspaceId: string, docs: DocMetaRecord[]): Promise<void>;
  subscribeDocUpdate(callback: (docId: string) => void): () => void;
}

export class DocStorageHandle {
  constructor(public readonly storage: DocStorage) {}
}
