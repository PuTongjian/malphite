import "./setup";
import {
  AppShell,
  configureBrowserDocStorageModules,
  configureCommonModules,
  Framework,
  FrameworkRoot,
  router,
  WorkerDocStorageDriver,
} from "@malphite/core";
import { RouterProvider } from "react-router-dom";

const worker = new Worker(new URL("./doc-storage-worker.ts", import.meta.url), {
  type: "module",
});

const framework = new Framework();
configureCommonModules(framework);
configureBrowserDocStorageModules(
  framework,
  new WorkerDocStorageDriver(worker),
);

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
