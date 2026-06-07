import { useParams } from "react-router-dom";
import { useService } from "~/src/framework/react";
import { DocService } from "~/src/modules/doc/doc-service";
import { useLiveData } from "~/src/shared/use-live-data";

type DocPageContentProps = {
  docId: string | undefined;
};

export function DocPageContent({ docId }: DocPageContentProps) {
  const docService = useService(DocService);
  const docs = useLiveData(docService.docs$);
  const ready = useLiveData(docService.ready$);
  const error = useLiveData(docService.error$);
  const doc = docs.find((item) => item.id === docId);

  if (error) {
    return <div>{error.message}</div>;
  }

  if (!ready) {
    return <div>Loading docs...</div>;
  }

  if (!doc) {
    return <div>Doc not found</div>;
  }

  return (
    <article>
      <input
        value={doc.title}
        onChange={(event) => docService.rename(doc.id, event.target.value)}
      />
      <p>{doc.content || "Empty doc"}</p>
    </article>
  );
}

export function DocPage() {
  const { docId } = useParams();

  return <DocPageContent docId={docId} />;
}
