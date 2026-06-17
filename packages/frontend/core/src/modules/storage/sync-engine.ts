import { LiveData } from "~/src/shared/live-data";
import type { DocStorage } from "./doc-storage";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export class SyncEngine {
  state$ = new LiveData<SyncState>("idle");
  error$ = new LiveData<Error | null>(null);

  constructor(local: DocStorage) {
    void local;
  }

  start() {
    this.state$.set("syncing");
    this.state$.set("synced");
  }

  stop() {
    this.state$.set("idle");
  }
}
