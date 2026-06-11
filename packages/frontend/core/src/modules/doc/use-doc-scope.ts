import { useEffect, useState } from "react";
import { useService } from "~/src/framework/react";
import { type DocOpenHandle, DocsService } from "./docs-service";

export function useDocScope(docId: string | undefined) {
  const docsService = useService(DocsService);
  const [handle, setHandle] = useState<DocOpenHandle | null>(null);

  useEffect(() => {
    if (!docId) {
      setHandle(null);
      return;
    }

    const opend = docsService.open(docId);
    setHandle(opend);

    return () => {
      opend.release();
      setHandle(null);
    };
  }, [docId, docsService]);

  return handle;
}
