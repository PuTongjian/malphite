import type { Doc } from "~/src/modules/doc/doc-types";

export type WorkerDocStorageOps = {
  loadDocs: {
    input: { workspaceId: string };
    output: Doc[];
  };
  saveDocs: {
    input: { workspaceId: string; docs: Doc[] };
    output: null;
  };
};

export type WorkerDocStorageMethod = keyof WorkerDocStorageOps;

export type WorkerRequestShape<M extends WorkerDocStorageMethod> = {
  id: string;
  method: M;
  payload: WorkerDocStorageOps[M]["input"];
};

export type WorkerRequest<
  M extends WorkerDocStorageMethod = WorkerDocStorageMethod,
> = {
  [K in M]: WorkerRequestShape<K>;
}[M];

export type WorkerResponse<
  M extends WorkerDocStorageMethod = WorkerDocStorageMethod,
> = M extends WorkerDocStorageMethod
  ?
      | {
          id: string;
          result: WorkerDocStorageOps[M]["output"];
        }
      | {
          id: string;
          error: string;
        }
  : never;
