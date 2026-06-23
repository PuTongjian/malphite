import { useService } from "~/src/framework/react";
import { DocsService } from "~/src/modules/doc/docs-service";
import { useDocScope } from "~/src/modules/doc/use-doc-scope";
import { useLiveData } from "~/src/shared/use-live-data";

type DocPageContentProps = {
  docId: string | undefined;
};

export function DocPageContent({ docId }: DocPageContentProps) {
  const docsService = useService(DocsService);
  const ready = useLiveData(docsService.ready$);
  const error = useLiveData(docsService.error$);
  const docHandle = useDocScope(docId);

  if (error) return <div>{error.message}</div>;
  if (!ready) return <div>Loading docs...</div>;
  if (!docHandle || !docId) return <div>Doc not found</div>;

  const doc = docHandle?.obj.doc ?? null;

  return <DocPageEditor doc={doc} docsService={docsService} />;
}

function DocPageEditor({
  doc,
  docsService,
}: {
  doc: NonNullable<ReturnType<typeof useDocScope>>["obj"]["doc"];
  docsService: DocsService;
}) {
  const title = useLiveData(doc.title$);
  const content = useLiveData(doc.content$);

  return (
    <article>
      <input
        value={title}
        onChange={(event) => {
          const nextTitle = event.target.value;
          doc.rename(nextTitle);
          docsService.rename(doc.id, nextTitle);
        }}
      />
      <textarea
        value={content}
        onChange={(event) => doc.setContent(event.target.value)}
      />
    </article>
  );
}
