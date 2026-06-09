import { FrameworkRoot } from "~/src/framework/react";
import { AllDocsPage } from "~/src/pages/workspace/all-docs-page";
import { DocPageContent } from "~/src/pages/workspace/doc-page";
import { WorkspaceSettingsPage } from "~/src/pages/workspace/settings-page";
import { useLiveData } from "~/src/shared/use-live-data";
import { useViewScope } from "./use-view-scope";
import type { View } from "./view";

function ViewContent({ path }: { path: string }) {
  if (path === "/all") {
    return <AllDocsPage />;
  }

  if (path === "/settings") {
    return <WorkspaceSettingsPage />;
  }

  return <DocPageContent docId={path.slice(1)} />;
}

export function ViewRoot({ view }: { view: View }) {
  const viewProvider = useViewScope(view);
  const path = useLiveData(view.path$);

  if (!viewProvider) return null;

  return (
    <FrameworkRoot framework={viewProvider}>
      <ViewContent path={path} />
    </FrameworkRoot>
  );
}
