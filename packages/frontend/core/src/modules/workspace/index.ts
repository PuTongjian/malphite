import type { Framework } from "~/src/framework/framework";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export function configureWorkspaceScopeModule(framework: Framework) {
  framework.service(WorkspaceService, (provider) => {
    return new WorkspaceService(provider.get(WorkspaceScope));
  });
}
