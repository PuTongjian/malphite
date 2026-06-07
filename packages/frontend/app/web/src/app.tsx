import "./setup";
import {
  AppShell,
  configureBrowserDocStorageModules,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const framework = new Framework();
configureCommonModules(framework);
configureBrowserDocStorageModules(framework);

const frameworkProvider = framework.provider();

export function App() {
  return (
    <FrameworkRoot framework={frameworkProvider}>
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    </FrameworkRoot>
  );
}
