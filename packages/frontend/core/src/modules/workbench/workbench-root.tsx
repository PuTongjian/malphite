import { useService } from "~/src/framework/react";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useLiveData } from "~/src/shared/use-live-data";
import { WorkbenchService } from "./workbench-service";

export function WorkbenchRoot() {
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

      <WorkbenchView path={activeView.path} />
    </section>
  );
}

function WorkbenchView({ path }: { path: string }) {
  console.log("Rendering WorkbenchView with path:", path);
  if (path === "/all") {
    return <AllDocsPage />;
  }

  if (path === "/settings") {
    return <WorkspaceSettingsPage />;
  }

  return <DocPageContent docId={path.slice(1)} />;
}
