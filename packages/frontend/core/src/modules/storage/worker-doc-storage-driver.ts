import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageDriver } from "./doc-storage-service";
import type {
  WorkerDocStorageMethod,
  WorkerDocStorageOps,
  WorkerRequest,
  WorkerResponse,
} from "./worker-doc-storage-rpc";

export class WorkerDocStorageDriver implements DocStorageDriver {
  constructor(private worker: Worker) {}

  load(workspaceId: string) {
    return this.requset("loadDocs", { workspaceId });
  }

  async save(workspaceId: string, docs: Doc[]) {
    await this.requset("saveDocs", { workspaceId, docs });
  }

  private requset<M extends WorkerDocStorageMethod>(
    method: M,
    payload: WorkerDocStorageOps[M]["input"],
  ) {
    return new Promise<WorkerDocStorageOps[M]["output"]>((resolve, reject) => {
      const id = crypto.randomUUID();

      const onMessage = (event: MessageEvent<WorkerResponse<M>>) => {
        if (event.data.id !== id) return;

        this.worker.removeEventListener("message", onMessage);

        if ("error" in event.data) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };

      this.worker.addEventListener("message", onMessage);
      this.worker.postMessage({
        id,
        method,
        payload,
      } satisfies WorkerRequest<M>);
    });
  }
}
