import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { WorkbenchService } from "~/src/modules/workbench/workbench-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function AllDocsPage() {
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
  const workbench = useService(WorkbenchService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  return (
    <section>
      <h1>{workspace.name}</h1>
      <button type="button" onClick={() => docService.create("Untitled")}>
        New Doc
      </button>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <button type="button" onClick={() => workbench.open(`/${doc.id}`)}>
              {doc.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
