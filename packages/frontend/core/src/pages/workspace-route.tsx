import { type PropsWithChildren, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  FrameworkRoot,
  useFrameworkProvider,
  useService,
} from "~/src/framework/react";
import { WorkbenchRoot } from "~/src/modules/workbench/workbench-root";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";

function WorkspaceScopeRoot({
  workspaceId,
}: PropsWithChildren<{ workspaceId: string }>) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const workspaceRef = useMemo(() => {
    if (!meta) {
      return null;
    }

    return workspacesService.open(meta, root);
  }, [meta, root, workspacesService]);

  useEffect(() => {
    return () => {
      workspaceRef?.dispose();
    };
  }, [workspaceRef]);

  if (!meta || !workspaceRef) {
    return <div>Workspace not found</div>;
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
