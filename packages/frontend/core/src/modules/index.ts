import type { Framework } from "~/src/framework/framework";
import { SiteService } from "./site/site-service";
import {
  configureDocStorageModule,
  configureSyncEngineModule,
} from "./storage";
import { WorkspacesService } from "./workspace/workspaces-service";

export function configureCommonModules(framework: Framework) {
  framework
    .service(SiteService, () => new SiteService())
    .service(WorkspacesService, () => new WorkspacesService());

  configureDocStorageModule(framework);
  configureSyncEngineModule(framework);
}
