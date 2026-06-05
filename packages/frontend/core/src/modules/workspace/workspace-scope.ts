import type { WorkspaceMeta } from "./workspaces-service";

export class WorkspaceScope {
  constructor(public meta: WorkspaceMeta) {}
}
