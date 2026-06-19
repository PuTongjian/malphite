import type { FrameworkProvider } from "~/src/framework/framework";
import type { WorkspaceEngine } from "./workspace-engine";
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceRef {
  constructor(
    public meta: WorkspaceMeta,
    public provider: FrameworkProvider,
    private engine: WorkspaceEngine,
  ) {}

  dispose() {
    this.engine.stop();
    this.provider.dispose();
  }
}
