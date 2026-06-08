import { useEffect, useState } from "react";
import { useFrameworkProvider, useService } from "~/src/framework/react";
import type { WorkspaceRef } from "./workspace-ref";
import { type WorkspaceMeta, WorkspacesService } from "./workspaces-service";

export function useWorkspaceScope(meta: WorkspaceMeta | undefined) {
  const root = useFrameworkProvider();
  const workspacesService = useService(WorkspacesService);
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

  return workspaceRef;
}
