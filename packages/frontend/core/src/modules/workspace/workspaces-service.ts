import type { FrameworkProvider } from "~/src/framework/framework";
import { DocService } from "~/src/modules/doc/doc-service";
import { DocStorageService } from "~/src/modules/storage/doc-storage-service";
import { WorkbenchService } from "~/src/modules/workbench/workbench-service";
import { LiveData } from "~/src/shared/live-data";
import { WorkspaceRef } from "./workspace-ref";
import { WorkspaceScope } from "./workspace-scope";
import { WorkspaceService } from "./workspace-service";

export type WorkspaceMeta = {
  id: string;
  name: string;
};

export class WorkspacesService {
  workspaces$ = new LiveData<WorkspaceMeta[]>([
    { id: "local", name: "Local Workspace" },
    { id: "demo", name: "Demo Workspace" },
  ]);

  get(id: string) {
    return this.workspaces$.value.find((workspace) => {
      workspace.id === id;
    });
  }

  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      framework
        .service(WorkspaceScope, () => new WorkspaceScope(meta))
        .service(WorkspaceService, (provider) => {
          return new WorkspaceService(provider.get(WorkspaceScope));
        })
        .service(DocService, (provider) => {
          return new DocService(
            provider.get(WorkspaceService),
            provider.get(DocStorageService),
          );
        })
        .service(WorkbenchService, () => new WorkbenchService());
    });

    return new WorkspaceRef(meta, provider);
  }
}
