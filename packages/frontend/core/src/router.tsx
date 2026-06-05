import { createBrowserRouter } from "react-router-dom";
import { useService } from "./framework/react";
import { SiteService } from "./modules/site/site-service";
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
  { path: "/workspace/:workspaceId", element: <WorkspaceRoute /> },
]);
