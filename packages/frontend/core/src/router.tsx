import { createBrowserRouter } from "react-router-dom";
import { siteService } from "./modules/site/site-service";
import { useLiveState } from "./shared/use-live-state";

function HomePage() {
  const title = useLiveState(siteService.title$);

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
]);
