import type { Doc, WorkerRequest, WorkerResponse } from "@malphite/core";

const docsByWorkspace = new Map<string, Doc[]>();

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, method, payload } = event.data;

  try {
    if (method === "loadDocs") {
      const { workspaceId } = payload;
      self.postMessage({
        id,
        result: docsByWorkspace.get(workspaceId) ?? [],
      } satisfies WorkerResponse<"loadDocs">);
      return;
    }

    if (method === "saveDocs") {
      const { workspaceId, docs } = payload;
      docsByWorkspace.set(workspaceId, docs);
      self.postMessage({
        id,
        result: null,
      } satisfies WorkerResponse<"saveDocs">);
      return;
    }

    self.postMessage({ id, error: `Unknown method: ${method}` });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
