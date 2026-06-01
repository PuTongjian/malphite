import {
  AppShell,
  Framework,
  FrameworkRoot,
  router,
  SiteService,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
framework.service(SiteService, new SiteService());

export function App() {
  return (
    <FrameworkRoot framework={framework}>
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    </FrameworkRoot>
  );
}
