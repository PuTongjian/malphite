import { useParams } from "react-router-dom";
import { FrameworkRoot, useService } from "~/src/framework/react";
import { WorkbenchRoot } from "~/src/modules/workbench/workbench-root";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";
import { useWorkspaceScope } from "../modules/workspace/use-workspace-scope";

function WorkspaceScopeRoot({ workspaceId }: { workspaceId: string }) {
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const workspaceRef = useWorkspaceScope(meta);

  if (!meta) {
    return <div>Workspace not found</div>;
  }

  if (!workspaceRef) {
    return <div>Loading workspace...</div>;
  }

  return (
    <FrameworkRoot framework={workspaceRef.provider}>
      <WorkbenchRoot />
    </FrameworkRoot>
  );
}

export function WorkspaceRoute() {
  const { workspaceId } = useParams();

  if (!workspaceId) {
    return <div>Workspace id is missing</div>;
  }

  return <WorkspaceScopeRoot workspaceId={workspaceId} />;
}
