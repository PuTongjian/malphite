import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "./doc-storage";
import { DocStorageProvider } from "./doc-storage-provider";
import type { DocStorageDriver } from "./doc-storage-service";
import { DocStorageService } from "./doc-storage-service";
import { LocalDocStorageDriver } from "./local-doc-storage-driver";
import { SyncEngine } from "./sync-engine";

export { DocStorageProvider } from "./doc-storage-provider";
export { DocStorageService } from "./doc-storage-service";
export { LocalDocStorageDriver } from "./local-doc-storage-driver";
export { WorkerDocStorageDriver } from "./worker-doc-storage-driver";

export function configureDocStorageModule(framework: Framework) {
  framework.service(DocStorageService, (provider) => {
    return new DocStorageService(provider.get(DocStorageProvider));
  });
}

export function configureBrowserDocStorageModules(
  framework: Framework,
  driver: DocStorageDriver = new LocalDocStorageDriver(),
) {
  framework.service(DocStorageProvider, () => {
    return new DocStorageProvider(driver);
  });
}

export function configureSyncEngineModule(framework: Framework) {
  framework.service(SyncEngine, (provider) => {
    return new SyncEngine(provider.get(DocStorageHandle).storage);
  });
}
