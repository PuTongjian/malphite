import type { Doc } from "~/src/modules/doc/doc-types";
import type { DocStorageProvider } from "./doc-storage-provider";

export interface DocStorageDriver {
  load(workspaceId: string): Promise<Doc[]>;
  save(workspaceId: string, docs: Doc[]): Promise<void>;
}

export class DocStorageService {
  constructor(private provider: DocStorageProvider) {}

  load(workspaceId: string): Promise<Doc[]> {
    return this.provider.driver.load(workspaceId);
  }

  save(workspaceId: string, docs: Doc[]): Promise<void> {
    return this.provider.driver.save(workspaceId, docs);
  }
}
