import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "~/src/modules/storage/doc-storage";
import { MemoryRemoteDocStorage } from "~/src/modules/storage/memory-remote-doc-storage";
import { SimpleSyncPeer } from "~/src/modules/storage/simple-sync-peer";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { WorkspaceEngine } from "./workspace-engine";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export function configureWorkspaceScopeModule(framework: Framework) {
  framework
    .service(WorkspaceService, (provider) => {
      return new WorkspaceService(provider.get(WorkspaceScope));
    })
    .service(MemoryRemoteDocStorage, () => {
      return new MemoryRemoteDocStorage();
    })
    .service(SimpleSyncPeer, (provider) => {
      return new SimpleSyncPeer(
        provider.get(DocStorageHandle).storage,
        provider.get(MemoryRemoteDocStorage),
      );
    })
    .service(SyncEngine, (provider) => {
      return new SyncEngine(provider.get(SimpleSyncPeer));
    })
    .service(WorkspaceEngine, (provider) => {
      return new WorkspaceEngine(provider.get(SyncEngine));
    });
}
