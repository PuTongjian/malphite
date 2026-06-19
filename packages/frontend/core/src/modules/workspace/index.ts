import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "~/src/modules/storage/doc-storage";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { WorkspaceEngine } from "./workspace-engine";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export function configureWorkspaceScopeModule(framework: Framework) {
  framework
    .service(WorkspaceService, (provider) => {
      return new WorkspaceService(provider.get(WorkspaceScope));
    })
    .service(SyncEngine, (provider) => {
      return new SyncEngine(provider.get(DocStorageHandle).storage);
    })
    .service(WorkspaceEngine, (provider) => {
      return new WorkspaceEngine(provider.get(SyncEngine));
    });
}
