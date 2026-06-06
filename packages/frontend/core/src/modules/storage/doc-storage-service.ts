import type { Doc } from "~/src/modules/doc/doc-types";

export interface DocStorageDriver {
  load(workspaceId: string): Doc[];
  save(workspaceId: string, docs: Doc[]): void;
}

export class DocStorageService {
  constructor(private driver: DocStorageDriver) {}

  load(workspaceId: string) {
    return this.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]) {
    this.driver.save(workspaceId, docs);
  }
}
