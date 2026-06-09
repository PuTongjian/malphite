import { useService } from "~/src/framework/react";
import { useLiveData } from "~/src/shared/use-live-data";
import { useBindWorkbenchToBrowserRouter } from "./use-bind-workbench-to-browser-router";
import { ViewRoot } from "./view-root";
import { WorkbenchService } from "./workbench-service";

export function WorkbenchRoot() {
  useBindWorkbenchToBrowserRouter();

  const workbench = useService(WorkbenchService);
  const views = useLiveData(workbench.views$);
  const activeViewId = useLiveData(workbench.activeViewId$);
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];

  if (!activeView) {
    return null;
  }

  return (
    <section>
      <header>
        <div role="tablist" aria-label="Workbench views">
          {views.map((view) => (
            <span key={view.id}>
              <button
                type="button"
                role="tab"
                aria-selected={view.id === activeView.id}
                onClick={() => workbench.activate(view.id)}
              >
                {view.title}
              </button>
              <button
                type="button"
                aria-label={`Close ${view.title}`}
                disabled={views.length <= 1}
                onClick={() => workbench.close(view.id)}
              >
                Close
              </button>
            </span>
          ))}
        </div>

        <nav aria-label="Workspace tools">
          <button type="button" onClick={() => workbench.open("/all")}>
            All Docs
          </button>
          <button type="button" onClick={() => workbench.open("/settings")}>
            Settings
          </button>
        </nav>
      </header>

      <ViewRoot view={activeView} />
    </section>
  );
}
