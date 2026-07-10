import * as Y from "yjs";

export type ToyDocFields = {
  title: string;
  content: string;
};

const ROOT_MAP = "root";
const TITLE_KEY = "title";
const CONTENT_TEXT = "content";

export function createEmptyToyYDoc() {
  return new Y.Doc();
}

export function readToyDocFields(doc: Y.Doc): ToyDocFields {
  const root = doc.getMap<string>(ROOT_MAP);
  const content = doc.getText(CONTENT_TEXT);

  return {
    title: root.get(TITLE_KEY) ?? "",
    content: content.toString(),
  };
}

export function writeToyDocFields(doc: Y.Doc, fields: ToyDocFields) {
  doc.transact(() => {
    const root = doc.getMap<string>(ROOT_MAP);
    const content = doc.getText(CONTENT_TEXT);

    root.set(TITLE_KEY, fields.title);
    content.delete(0, content.length);
    content.insert(0, fields.content);
  }, "local");
}

export function encodeToyDocState(doc: Y.Doc) {
  return Y.encodeStateAsUpdate(doc);
}

export function applyToyDocUpdate(doc: Y.Doc, update: Uint8Array) {
  Y.applyUpdate(doc, update, "storage");
}
