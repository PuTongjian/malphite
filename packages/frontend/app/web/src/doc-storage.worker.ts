import type { WorkerRequest, WorkerResponse } from "@malphite/core";
import { loadDocs, saveDocs } from "./doc-storage-idb";

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest) {
  const { id, method, payload } = request;

  try {
    if (method === "loadDocs") {
      const { workspaceId } = payload;
      self.postMessage({
        id,
        result: await loadDocs(workspaceId),
      } satisfies WorkerResponse<"loadDocs">);
      return;
    }

    if (method === "saveDocs") {
      const { workspaceId, docs } = payload;
      await saveDocs(workspaceId, docs);
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
}
