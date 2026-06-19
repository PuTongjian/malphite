import type { SyncEngine } from "~/src/modules/storage/sync-engine";

export class WorkspaceEngine {
  private started: boolean = false;

  constructor(private sync: SyncEngine) {}

  start() {
    if (this.started) return;

    this.sync.start();
    this.started = true;
  }

  stop() {
    if (!this.started) return;

    this.started = false;
    this.sync.stop();
  }

  dispose() {
    this.stop();
  }
}
