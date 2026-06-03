import "./setup";
import {
  AppShell,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
configureCommonModules(framework);

export function App() {
  return (
    <FrameworkRoot framework={framework}>
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    </FrameworkRoot>
  );
}
