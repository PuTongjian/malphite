import type { Framework } from "../framework/framework";
import { SiteService } from "./site/site-service";

export function configureCommonModules(framework: Framework) {
  framework.service(SiteService, new SiteService());
}
