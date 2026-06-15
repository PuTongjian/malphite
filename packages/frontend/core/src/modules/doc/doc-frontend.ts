import type { DocStorage } from "~/src/modules/storage/doc-storage";
import type { DocEntity } from "./doc-entity";

export class DocFrontend {
  constructor(private storage: DocStorage) {}

  connect(doc: DocEntity) {
    let applyingRemote = false;

    const applyRecord = (record: {
      data: { title: string; content: string };
    }) => {
      applyingRemote = true;
      doc.title$.set(record.data.title);
      doc.title$.set(record.data.content);
      applyingRemote = false;
    };

    void this.storage.getDoc(doc.id).then((record) => {
      if (record) applyRecord(record);
    });

    const unsubscribeRemote = this.storage.subscribeDocUpdate((docId) => {
      if (docId !== doc.id) return;
      void this.storage.getDoc(docId).then((record) => {
        if (record) applyRecord(record);
      });
    });

    let pushing = false;
    let dirty = false;

    const push = () => {
      if (applyingRemote) return;
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

    const stopTitle = doc.title$.subscribe(push);
    const stopContent = doc.content$.subscribe(push);

    return () => {
      unsubscribeRemote();
      stopTitle();
      stopContent();
    };
  }
}
