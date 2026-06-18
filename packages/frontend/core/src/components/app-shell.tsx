import type { PropsWithChildren } from "react";

// 示例
import { useService } from "~/src/framework/react";
import { SyncEngine } from "~/src/modules/storage/sync-engine";
import { useLiveData } from "~/src/shared/use-live-data";

function SyncStatus() {
  const sync = useService(SyncEngine);
  const state = useLiveData(sync.state$);
  return <span>Sync: {state}</span>;
}
// 示例

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <header>Malphite header</header>
      <SyncStatus></SyncStatus>
      <main>{children}</main>
    </div>
  );
}
