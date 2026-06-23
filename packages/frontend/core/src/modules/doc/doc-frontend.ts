import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    let applyingRemote = false;
    let initialLoadComplete = false;
    let titleChangedBeforeInitialLoad = false;
    let contentChangedBeforeInitialLoad = false;

    const applyRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      doc.title$.set(record.data.title);
      doc.content$.set(record.data.content);
      applyingRemote = false;
    };

    const applyInitialRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      if (!titleChangedBeforeInitialLoad) {
        doc.title$.set(record.data.title);
      }

      if (!contentChangedBeforeInitialLoad) {
        doc.content$.set(record.data.content);
      }

      applyingRemote = false;
    };

    const applyStorageRecord = (record: {
      data: { title: string; content: string };
    }) => {
      if (initialLoadComplete) {
        applyRecord(record);
      } else {
        applyInitialRecord(record);
      }
    };

    void this.storage
      .getDoc(doc.id)
      .then((record) => {
        if (record) applyStorageRecord(record);
      })
      .finally(() => {
        initialLoadComplete = true;
        if (dirty) {
          dirty = false;
          push();
        }
      });

    const unsubscribeRemote = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((record) => {
        if (record) applyStorageRecord(record);
      });
    });

    let pushing = false;
    let dirty = false;

    const push = () => {
      if (applyingRemote) return;

      if (!initialLoadComplete) {
        dirty = true;
        return;
      }

      if (pushing) {
        dirty = true;
        return;
      }

      pushing = true;
      void this.storage
        .pushDocUpdate(doc.id, {
          title: doc.title$.value,
          content: doc.content$.value,
        })
        .finally(() => {
          pushing = false;
          if (dirty) {
            dirty = false;
            push();
          }
        });
    };

    const markLocalChange = (field: "title" | "content") => {
      if (applyingRemote) return;
      if (!initialLoadComplete) {
        if (field === "title") {
          titleChangedBeforeInitialLoad = true;
        } else {
          contentChangedBeforeInitialLoad = true;
        }

        dirty = true;
        return;
      }
      push();
    };

    const stopTitle = doc.title$.subscribe(() => markLocalChange("title"));
    const stopContent = doc.content$.subscribe(() =>
      markLocalChange("content"),
    );

    return () => {
      unsubscribeRemote();
      stopTitle();
      stopContent();
    };
  }
}
