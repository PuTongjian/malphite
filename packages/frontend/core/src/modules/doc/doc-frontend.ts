import * as Y from "yjs";
import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";
import { applyToyDocUpdate } from "./yjs-doc-codec";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    let applyingStorage = false;
    let initialLoadComplete = false;
    let queuedBeforeInitialLoad = false;
    let pushing = false;
    let queuedUpdate: Uint8Array | null = null;

    const pushUpdate = (update: Uint8Array) => {
      if (applyingStorage) return;

      if (!initialLoadComplete) {
        queuedBeforeInitialLoad = true;
        queuedUpdate = mergeQueuedUpdate(queuedUpdate, update);
        return;
      }

      if (pushing) {
        queuedUpdate = mergeQueuedUpdate(queuedUpdate, update);
        return;
      }

      pushing = true;
      void this.storage.pushDocUpdate(doc.id, update).finally(() => {
        pushing = false;

        if (queuedUpdate) {
          const next = queuedUpdate;
          queuedUpdate = null;
          pushUpdate(next);
        }
      });
    };

    const handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "storage") return;

      pushUpdate(update);
    };

    doc.ydoc.on("update", handleLocalUpdate);

    void this.storage
      .getDocUpdates(doc.id)
      .then((updates) => {
        applyingStorage = true;
        doc.applyRemoteUpdate(() => {
          for (const record of updates) {
            applyToyDocUpdate(doc.ydoc, record.update);
          }
        });
      })
      .finally(() => {
        applyingStorage = false;
        initialLoadComplete = true;

        if (queuedBeforeInitialLoad && queuedUpdate) {
          queuedBeforeInitialLoad = false;
          const update = queuedUpdate;
          queuedUpdate = null;
          pushUpdate(update);
        }
      });

    const unsubscribeStorage = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;

      void this.storage.getDocUpdates(doc.id).then((updates) => {
        applyingStorage = true;
        try {
          doc.applyRemoteUpdate(() => {
            for (const record of updates) {
              applyToyDocUpdate(doc.ydoc, record.update);
            }
          });
        } finally {
          applyingStorage = false;
        }
      });
    });

    return () => {
      doc.ydoc.off("update", handleLocalUpdate);
      unsubscribeStorage();
    };
  }
}

function mergeQueuedUpdate(
  current: Uint8Array | null,
  next: Uint8Array,
): Uint8Array {
  if (!current) {
    return next;
  }

  return Y.mergeUpdates([current, next]);
}
