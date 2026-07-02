import type { DocStorage } from "./doc-storage";

export class SimpleSyncPeer {
  private localClock = new Map<string, number>();
  private remoteAppliedLocalClocks = new Map<string, Set<number>>();
  private remoteClock = new Map<string, number>();
  private pullingFromRemote = new Set<string>();
  private pushingToRemote = new Set<string>();
  private syncingDoc = new Set<string>();
  private pushAgain = new Set<string>();
  private pullAgain = new Set<string>();
  private started = false;
  private unsubscribeLocal: (() => void) | null = null;
  private unsubscribeRemote: (() => void) | null = null;

  constructor(
    private local: DocStorage,
    private remote: DocStorage,
  ) {}

  start() {
    if (this.started) return;

    this.started = true;

    this.unsubscribeLocal = this.local.subscribeDocUpdate((docId) => {
      if (this.pullingFromRemote.has(docId) || this.syncingDoc.has(docId)) {
        this.pushAgain.add(docId);
        return;
      }

      void this.push(docId);
    });

    this.unsubscribeRemote = this.remote.subscribeDocUpdate((docId) => {
      if (this.pushingToRemote.has(docId) || this.syncingDoc.has(docId)) {
        this.pullAgain.add(docId);
        return;
      }

      void this.pull(docId);
    });
  }

  stop() {
    if (!this.started) return;

    this.started = false;
    this.unsubscribeLocal?.();
    this.unsubscribeRemote?.();
    this.unsubscribeLocal = null;
    this.unsubscribeRemote = null;
  }

  async syncDoc(docId: string) {
    if (this.syncingDoc.has(docId)) {
      this.pushAgain.add(docId);
      this.pullAgain.add(docId);
      return;
    }

    this.syncingDoc.add(docId);
    try {
      const lastLocalClock = this.localClock.get(docId) ?? 0;
      const lastRemoteClock = this.remoteClock.get(docId) ?? 0;
      const localUpdates = await this.local.getDocUpdatesAfter(
        docId,
        lastLocalClock,
      );
      const remoteUpdates = await this.remote.getDocUpdatesAfter(
        docId,
        lastRemoteClock,
      );

      this.pullingFromRemote.add(docId);
      try {
        for (const record of remoteUpdates) {
          const localRecord = await this.local.pushDocUpdate(
            docId,
            record.update,
          );

          this.rememberRemoteClock(docId, record.clock);
          this.rememberRemoteAppliedLocalClock(docId, localRecord.clock);
        }
      } finally {
        this.pullingFromRemote.delete(docId);
      }

      this.pushingToRemote.add(docId);
      try {
        for (const record of localUpdates) {
          const remoteRecord = await this.remote.pushDocUpdate(
            docId,
            record.update,
          );
          this.rememberLocalClock(docId, record.clock);
          this.rememberRemoteClock(docId, remoteRecord.clock);
        }
      } finally {
        this.pushingToRemote.delete(docId);
      }
    } finally {
      this.syncingDoc.delete(docId);
    }

    if (this.pullAgain.has(docId) || this.pushAgain.has(docId)) {
      await this.pull(docId);
      await this.push(docId);
    }
  }

  async push(docId: string) {
    if (this.pushingToRemote.has(docId)) {
      this.pushAgain.add(docId);
      return;
    }

    this.pushingToRemote.add(docId);
    try {
      do {
        this.pushAgain.delete(docId);

        const lastLocalClock = this.localClock.get(docId) ?? 0;
        const updates = await this.local.getDocUpdatesAfter(
          docId,
          lastLocalClock,
        );

        for (const record of updates) {
          if (this.wasAppliedFromRemote(docId, record.clock)) {
            this.rememberLocalClock(docId, record.clock);
            continue;
          }

          const remoteRecord = await this.remote.pushDocUpdate(
            docId,
            record.update,
          );
          this.rememberLocalClock(docId, record.clock);
          this.rememberRemoteClock(docId, remoteRecord.clock);
        }
      } while (this.pushAgain.has(docId));
    } finally {
      this.pushingToRemote.delete(docId);
      this.pushAgain.delete(docId);
    }
  }

  async pull(docId: string) {
    if (this.pullingFromRemote.has(docId)) {
      this.pullAgain.add(docId);
      return;
    }

    this.pullingFromRemote.add(docId);
    try {
      do {
        this.pullAgain.delete(docId);

        const lastRemoteClock = this.remoteClock.get(docId) ?? 0;
        const updates = await this.remote.getDocUpdatesAfter(
          docId,
          lastRemoteClock,
        );

        for (const record of updates) {
          const localRecord = await this.local.pushDocUpdate(
            docId,
            record.update,
          );
          this.rememberRemoteClock(docId, record.clock);
          this.rememberRemoteAppliedLocalClock(docId, localRecord.clock);
        }
      } while (this.pullAgain.has(docId));
    } finally {
      this.pullingFromRemote.delete(docId);
      this.pullAgain.delete(docId);
    }
  }

  private wasAppliedFromRemote(docId: string, clock: number) {
    return this.remoteAppliedLocalClocks.get(docId)?.has(clock) ?? false;
  }

  private rememberLocalClock(docId: string, clock: number) {
    this.localClock.set(
      docId,
      Math.max(this.localClock.get(docId) ?? 0, clock),
    );
  }

  private rememberRemoteAppliedLocalClock(docId: string, clock: number) {
    const clocks =
      this.remoteAppliedLocalClocks.get(docId) ?? new Set<number>();
    clocks.add(clock);
    this.remoteAppliedLocalClocks.set(docId, clocks);
  }

  private rememberRemoteClock(docId: string, clock: number) {
    this.remoteClock.set(
      docId,
      Math.max(this.remoteClock.get(docId) ?? 0, clock),
    );
  }
}
