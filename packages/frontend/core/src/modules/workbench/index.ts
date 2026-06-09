import type { Framework, FrameworkProvider } from "~/src/framework/framework";
import { View, type ViewProps } from "./view";
import { WorkbenchService } from "./workbench-service";

export function configureWorkbenchModule(framework: Framework) {
  framework
    .entity(View, (_provider, props: ViewProps) => {
      return new View(crypto.randomUUID(), props);
    })
    .service(WorkbenchService, (provider: FrameworkProvider) => {
      return new WorkbenchService(provider);
    });
}
