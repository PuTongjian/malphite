import type { Doc } from "@malphite/core";

const DB_NAME = "malphite-doc-storage";
const STORE_NAME = "docs";
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
    };
  });

  return databasePromise;
}

export async function loadDocs(workspaceId: string): Promise<Doc[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(workspaceId) as IDBRequest<
      Doc[] | undefined
    >;

    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to load docs"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB read aborted"));
  });
}

export async function saveDocs(
  workspaceId: string,
  docs: Doc[],
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(docs, workspaceId);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save docs"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}
