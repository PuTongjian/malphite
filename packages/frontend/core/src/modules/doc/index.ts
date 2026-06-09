import type { Framework } from "~/src/framework/framework";
import { DocStorageService } from "~/src/modules/storage";
import { WorkspaceService } from "../workspace/workspace-service";
import { DocService } from "./doc-service";
import { DocStore } from "./doc-store";

export function configureDocModule(framework: Framework) {
  framework
    .service(DocStore, (provider) => {
      return new DocStore(provider.get(DocStorageService));
    })
    .service(DocService, (provider) => {
      return new DocService(
        provider.get(WorkspaceService),
        provider.get(DocStore),
      );
    });
}
