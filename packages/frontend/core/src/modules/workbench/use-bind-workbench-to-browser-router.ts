import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { LiveData } from "~/src/shared/live-data";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

const EMPTY_PATH$ = new LiveData("");

function splatToViewPath(splat: string | undefined) {
  if (!splat) return "/all";

  return splat.startsWith("/") ? splat : `/${splat}`;
}

function viewPathToSplat(viewPath: string) {
  if (viewPath === "/all") return "all";

  return viewPath.startsWith("/") ? viewPath.slice(1) : viewPath;
}

function buildBrowserPath(workspaceId: string, viewPath: string) {
  const splat = viewPathToSplat(viewPath);
  return `/workspace/${workspaceId}/${splat}`;
}

export function useBindWorkbenchToBrowserRouter() {
  const navigate = useNavigate();
  const { workspaceId, "*": splat } = useParams();
  const workbench = useService(WorkbenchService);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = workbench.activeView;
  const activeViewPath = useLiveData(activeView?.path$ ?? EMPTY_PATH$);

  const syncSource = useRef<"browser" | "workbench" | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    if (syncSource.current === "workbench") {
      syncSource.current = null;
      return;
    }

    syncSource.current = "browser";

    workbench.open(splatToViewPath(splat));
  }, [workspaceId, splat, workbench]);

  useEffect(() => {
    if (!workspaceId || !activeView) return;

    if (syncSource.current === "browser") {
      syncSource.current = null;
      return;
    }

    const nextPath = buildBrowserPath(workspaceId, activeViewPath);
    const currentPath = buildBrowserPath(workspaceId, splatToViewPath(splat));

    if (nextPath === currentPath) return;

    syncSource.current = "workbench";

    navigate(nextPath, { replace: true });
  }, [workspaceId, activeViewId, activeViewPath, navigate, splat]);
}
