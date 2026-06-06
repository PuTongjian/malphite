import type { FrameworkProvider } from "~/src/framework/framework";
import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceRef {
  constructor(
    public meta: WorkspaceMeta,
    public provider: FrameworkProvider,
  ) {}

  dispose() {
    this.provider.dispose();
  }
}
