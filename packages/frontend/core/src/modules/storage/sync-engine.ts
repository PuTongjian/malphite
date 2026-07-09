import { LiveData } from "~/src/shared/live-data";
import type { SimpleSyncPeer } from "./simple-sync-peer";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export class SyncEngine {
  state$ = new LiveData<SyncState>("idle");
  error$ = new LiveData<Error | null>(null);

  constructor(private peer: SimpleSyncPeer) {}

  start() {
    if (this.state$.value !== "idle") {
      return;
    }

    this.error$.set(null);
    this.state$.set("syncing");

    try {
      this.peer.start();
      this.state$.set("synced");
    } catch (error) {
      this.error$.set(toError(error));
      this.state$.set("error");
      throw error;
    }
  }

  stop() {
    this.peer.stop();
    this.state$.set("idle");
  }
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
