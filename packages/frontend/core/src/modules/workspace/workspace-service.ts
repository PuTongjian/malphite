import { LiveState } from "../../shared/live-state";

export type Workspace = {
  id: string;
  name: string;
};

export class WorkspaceService {
  workspaces$ = new LiveState<Workspace[]>([
    { id: "local", name: "Local Workspace" },
  ]);

  current$ = new LiveState<Workspace | null>(null);

  open(id: string) {
    const workspace = this.workspaces$.value.find((item) => item.id === id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    this.current$.set(workspace);
  }
}
