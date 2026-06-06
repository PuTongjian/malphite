import { createBrowserRouter, Navigate } from "react-router-dom";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useService } from "./framework/react";
import { SiteService } from "./modules/site/site-service";
import { AllDocsPage } from "./pages/workspace/all-docs-page";
import { DocPage } from "./pages/workspace/doc-page";
import { WorkspaceRoute } from "./pages/workspace-route";
import { useLiveData } from "./shared/use-live-data";

function HomePage() {
  const siteService = useService(SiteService);
  const title = useLiveData(siteService.title$);

  return (
    <div>
      <h1>{title}</h1>
      <button
        type="button"
        onClick={() => siteService.rename("Malphite is the best!")}
      >
        Rename
      </button>
    </div>
  );
}

function AboutPage() {
  return <h1>关于</h1>;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/about", element: <AboutPage /> },
  {
    path: "/workspace/:workspaceId",
    element: <WorkspaceRoute />,
    children: [
      { index: true, element: <Navigate to="all" replace /> },
      { path: "all", element: <AllDocsPage /> },
      { path: ":docId", element: <DocPage /> },
      { path: "settings", element: <WorkspaceSettingsPage /> },
    ],
  },
]);
