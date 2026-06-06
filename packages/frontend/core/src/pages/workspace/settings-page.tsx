import { useService } from "~/src/framework/react";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";

export function WorkspaceSettingsPage() {
  const workspace = useService(WorkspaceService);

  return <h1>{workspace.name} settings</h1>;
}
