import type { Doc, DocRecord, DocStorage } from "@malphite/core";

const DB_NAME = "malphite-doc-storage";
const DOC_STORE = "doc-records";
const META_STORE = "meta";
// ← Phase 1 worker 旧 store，仅给下面遗留的 loadDocs/saveDocs 用
const LEGACY_DOC_STORE = "docs";
const DB_VERSION = 2;

type MetaRecord = {
  workspaceId: string;
  docIds: string[];
};

let databasePromise: Promise<IDBDatabase> | null = null;

const subscribers = new Set<(docId: string) => void>();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("malphite-doc-update")
    : null;

channel?.addEventListener(
  "message",
  (event: MessageEvent<{ docId: string }>) => {
    for (const cb of subscribers) {
      cb(event.data.docId);
    }
  },
);

function notify(docId: string) {
  for (const cb of subscribers) {
    cb(docId);
  }

  channel?.postMessage({ docId });
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE);
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }

      if (!db.objectStoreNames.contains(LEGACY_DOC_STORE)) {
        db.createObjectStore(LEGACY_DOC_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
    };
  });

  return databasePromise;
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key) as IDBRequest<T>;
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function createIndexedDbDocStorage(): DocStorage {
  return {
    async getDoc(docId) {
      return (await idbGet<DocRecord>(DOC_STORE, docId)) ?? null;
    },

    async pushDocUpdate(docId, data) {
      const record: DocRecord = {
        docId,
        data,
        timestamp: Date.now(),
      };

      await idbPut(DOC_STORE, docId, record);
      notify(docId);
    },

    async getDocList(workspaceId: string) {
      const meta = await idbGet<MetaRecord>(META_STORE, workspaceId);
      return meta?.docIds ?? [];
    },

    async setDocList(workspaceId: string, docIds: string[]) {
      await idbPut(META_STORE, workspaceId, {
        workspaceId,
        docIds,
      } satisfies MetaRecord);
    },

    subscribeDocUpdate(callback: (docId: string) => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}

export async function loadDocs(workspaceId: string): Promise<Doc[]> {
  return (await idbGet<Doc[]>(LEGACY_DOC_STORE, workspaceId)) ?? [];
}

export async function saveDocs(
  workspaceId: string,
  docs: Doc[],
): Promise<void> {
  await idbPut(LEGACY_DOC_STORE, workspaceId, docs);
}
