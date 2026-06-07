import { Link } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { WorkspaceService } from "~/src/modules/workspace/workspace-service";
import { useLiveData } from "~/src/shared/use-live-data";

export function AllDocsPage() {
  const workspace = useService(WorkspaceService);
  const docService = useService(DocService);
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
            <Link to={`/workspace/${workspace.id}/${doc.id}`}>{doc.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
