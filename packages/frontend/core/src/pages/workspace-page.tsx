import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useService } from "../framework/react";
import { WorkspaceService } from "../modules/workspace/workspace-service";
import { useLiveState } from "../shared/use-live-state";

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const workspaceService = useService(WorkspaceService);
  const current = useLiveState(workspaceService.current$);

  useEffect(() => {
    if (workspaceId) {
      workspaceService.open(workspaceId);
    }
  }, [workspaceId, workspaceService]);

  if (!current) {
    return <div>Loading workspace...</div>;
  }

  return <h1>{current.name}</h1>;
}
