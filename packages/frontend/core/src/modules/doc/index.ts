import type { Framework } from "~/src/framework/framework";
import { DocStorageHandle } from "~/src/modules/storage/doc-storage";
import { SimpleSyncPeer } from "~/src/modules/storage/simple-sync-peer";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { DocFrontend } from "./doc-frontend";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";
import { DocsService } from "./docs-service";

export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (provider) => {
      return new DocStore(
        provider.get(DocStorageHandle).storage,
        provider.get(WorkspaceService).id,
      );
    })
    .service(DocFrontend, (provider) => {
      return new DocFrontend(provider.get(DocStorageHandle).storage);
    })
    .service(DocService, (provider) => {
      return new DocService(provider.get(DocStore));
    })
    .service(DocsService, (provider) => {
      return new DocsService(
        provider,
        provider.get(DocService),
        provider.get(DocFrontend),
        provider.get(SimpleSyncPeer),
      );
    });
}
