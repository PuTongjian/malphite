import type { Framework } from "~/src/framework/framework";
import { DocStorageProvider } from "./doc-storage-provider";
import { DocStorageService } from "./doc-storage-service";
import { LocalDocStorageDriver } from "./local-doc-storage-driver";

export { DocStorageProvider } from "./doc-storage-provider";
export { DocStorageService } from "./doc-storage-service";
export { LocalDocStorageDriver } from "./local-doc-storage-driver";

export function configureDocStorageModule(framework: Framework) {
  framework.service(DocStorageService, (provider) => {
    return new DocStorageService(provider.get(DocStorageProvider));
  });
}

export function configureBrowserDocStorageModules(framework: Framework) {
  framework.service(DocStorageProvider, () => {
    return new DocStorageProvider(new LocalDocStorageDriver());
  });
}
