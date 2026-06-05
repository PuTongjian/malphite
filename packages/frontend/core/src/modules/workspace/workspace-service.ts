import type { WorkspaceScope } from "./workspace-scope";

export class WorkspaceService {
  constructor(private scope: WorkspaceScope) {}

  get id() {
    return this.scope.meta.id;
  }

  get name() {
    return this.scope.meta.name;
  }
}
