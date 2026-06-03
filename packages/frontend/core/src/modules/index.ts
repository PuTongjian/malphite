import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";
import { WorkspaceService } from "./workspace/workspace-service";

export function configureCommonModules(framework: Framework) {
  framework.service(SiteService, () => new SiteService());
  framework.service(WorkspaceService, () => new WorkspaceService());
}
