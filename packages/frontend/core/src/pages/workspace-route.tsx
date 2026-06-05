import { type PropsWithChildren, useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import {
  FrameworkRoot,
  useFrameworkProvider,
  useService,
} from "~/src/framework/react";
import { WorkspaceScope } from "~/src/modules/workspace/workspace-scope";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { WorkspacesService } from "~/src/modules/workspace/workspaces-service";
import { useLiveData } from "~/src/shared/use-live-data";

function WorkspaceScopeRoot({
  workspaceId,
  children,
}: PropsWithChildren<{ workspaceId: string }>) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.workspaces$);
  const meta = workspaces.find((workspace) => workspace.id === workspaceId);

  const provider = useMemo(() => {
    if (!meta) {
      return null;
    }

    return root.createChild((framework) => {
      framework
        .service(WorkspaceScope, () => new WorkspaceScope(meta))
        .service(
          WorkspaceService,
          (provider) => new WorkspaceService(provider.get(WorkspaceScope)),
        );
    });
  }, [meta, root]);

  useEffect(() => {
    return () => {
      provider?.dispose();
    };
  }, [provider]);

  if (!meta || !provider) {
    return <div>Workspace not found</div>;
  }

  return <FrameworkRoot framework={provider}>{children}</FrameworkRoot>;
}

export function WorkspaceRoute() {
  const { workspaceId } = useParams();

  if (!workspaceId) {
    return <div>Workspace id is missing</div>;
  }

  return (
    <WorkspaceScopeRoot workspaceId={workspaceId}>
      <Outlet />
    </WorkspaceScopeRoot>
  );
}
