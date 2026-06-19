import type { FrameworkProvider } from "~/src/framework/framework";
import { configureDocModule } from "~/src/modules/doc";
import { configureWorkbenchModule } from "~/src/modules/workbench";
import { LiveData } from "~/src/shared/live-data";
import { configureWorkspaceScopeModule } from "./index";
import { WorkspaceEngine } from "./workspace-engine";
import { WorkspaceRef } from "./workspace-ref";
import { WorkspaceScope } from "./workspace-scope";

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
      return workspace.id === id;
    });
  }

  open(meta: WorkspaceMeta, rootProvider: FrameworkProvider) {
    const provider = rootProvider.createChild((framework) => {
      framework.service(WorkspaceScope, () => new WorkspaceScope(meta));

      configureWorkspaceScopeModule(framework);
      configureDocModule(framework);
      configureWorkbenchModule(framework);
    });
    try {
      const engine = provider.get(WorkspaceEngine);
      engine.start();

      return new WorkspaceRef(meta, provider, engine);
    } catch (error) {
      provider.dispose();
      throw error;
    }
  }
}
