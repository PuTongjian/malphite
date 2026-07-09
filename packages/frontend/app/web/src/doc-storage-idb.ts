import type {
  DocMetaRecord,
  DocStorage,
  DocUpdateRecord,
} from "@malphite/core";

const DB_NAME = "malphite-doc-storage";
const DOC_UPDATE_STORE = "doc-updates";
const META_STORE = "meta";
const DB_VERSION = 3;

type MetaRecord = {
  workspaceId: string;
  docs: DocMetaRecord[];
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
      if (!db.objectStoreNames.contains(DOC_UPDATE_STORE)) {
        db.createObjectStore(DOC_UPDATE_STORE);
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
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
    async getDocUpdates(docId) {
      return (await idbGet<DocUpdateRecord[]>(DOC_UPDATE_STORE, docId)) ?? [];
    },

    async getDocUpdatesAfter(docId, clock) {
      const records =
        (await idbGet<DocUpdateRecord[]>(DOC_UPDATE_STORE, docId)) ?? [];

      return records.filter((records) => records.clock > clock);
    },

    async pushDocUpdate(docId, update) {
      const records =
        (await idbGet<DocUpdateRecord[]>(DOC_UPDATE_STORE, docId)) ?? [];
      const record: DocUpdateRecord = {
        docId,
        update,
        clock: records.length + 1,
        timestamp: Date.now(),
      };

      await idbPut(DOC_UPDATE_STORE, docId, [...records, record]);
      notify(docId);

      return record;
    },

    async getDocClock(docId) {
      const records =
        (await idbGet<DocUpdateRecord[]>(DOC_UPDATE_STORE, docId)) ?? [];

      return records.at(-1)?.clock ?? 0;
    },

    async getDocList(workspaceId: string) {
      const meta = await idbGet<MetaRecord>(META_STORE, workspaceId);
      return meta?.docs ?? [];
    },

    async setDocList(workspaceId: string, docs: DocMetaRecord[]) {
      await idbPut(META_STORE, workspaceId, {
        workspaceId,
        docs,
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
