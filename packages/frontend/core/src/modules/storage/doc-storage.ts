export type DocRecordData = {
  title: string;
  content: string;
};

export type DocRecord = {
  docId: string;
  data: DocRecordData;
  timestamp: number;
};

export interface DocStorage {
  getDoc(docId: string): Promise<DocRecord | null>;
  pushDocUpdate(docId: string, data: DocRecordData): Promise<void>;
  getDocList(workspaceId: string): Promise<string[]>;
  setDocList(workspaceId: string, docIds: string[]): Promise<void>;
  subscribeDocUpdate(callback: (docId: string) => void): () => void;
}
