import type { Framework } from "~/src/framework/framework";
import { SiteService } from "./site/site-service";
import { DocStorageService } from "./storage/doc-storage-service";
import { LocalDocStorageDriver } from "./storage/local-doc-storage-driver";
import { WorkspacesService } from "./workspace/workspaces-service";

export function configureCommonModules(framework: Framework) {
  framework
    .service(SiteService, () => new SiteService())
    .service(WorkspacesService, () => new WorkspacesService())
    .service(DocStorageService, () => {
      return new DocStorageService(new LocalDocStorageDriver());
    });
}
