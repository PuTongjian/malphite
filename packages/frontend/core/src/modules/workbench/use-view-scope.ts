import { useEffect, useState } from "react";
import type { FrameworkProvider } from "~/src/framework/framework";
import { useFrameworkProvider } from "~/src/framework/react";
import type { View } from "./view";
import { ViewScope } from "./view-scope";

export function useViewScope(view: View) {
  const workspaceProvider = useFrameworkProvider();
  const [viewProvider, setViewProvider] = useState<FrameworkProvider | null>(
    null,
  );

  useEffect(() => {
    const provider = workspaceProvider.createChild((framework) => {
      framework.service(ViewScope, () => new ViewScope(view));
    });

    setViewProvider(provider);

    return () => {
      provider.dispose();
      setViewProvider(null);
    };
  }, [workspaceProvider, view]);

  return viewProvider;
}
