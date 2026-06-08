import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FrameworkRoot,
  useFrameworkProvider,
  useService,
} from "~/src/framework/react";
import { WorkbenchRoot } from "~/src/modules/workbench/workbench-root";
import type { WorkspaceRef } from "~/src/modules/workspace/workspace-ref";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";

function WorkspaceScopeRoot({ workspaceId }: { workspaceId: string }) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);
  const [workspaceRef, setWorkspaceRef] = useState<WorkspaceRef | null>(null);

  useEffect(() => {
    if (!meta) {
      setWorkspaceRef(null);
      return;
    }

    const ref = workspacesService.open(meta, root);
    setWorkspaceRef(ref);

    return () => {
      ref.dispose();
      setWorkspaceRef(null);
    };
  }, [meta, root, workspacesService]);

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
