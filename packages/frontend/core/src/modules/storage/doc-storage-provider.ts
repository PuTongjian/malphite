import type { DocStorageDriver } from "./doc-storage-service";

export class DocStorageProvider {
  constructor(public driver: DocStorageDriver) {}
}
