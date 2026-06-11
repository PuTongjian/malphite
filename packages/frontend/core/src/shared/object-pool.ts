type PoolEntry<T> = {
  obj: T;
  refs: number;
};

export type PoolHandle<T> = {
  obj: T;
  release: () => void;
};

export class ObjectPool<T extends { dispose(): void }> {
  private map = new Map<string, PoolEntry<T>>();

  get(key: string): PoolHandle<T> | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    entry.refs += 1;

    return {
      obj: entry.obj,
      release: () => this.release(key),
    };
  }

  put(key: string, obj: T): PoolHandle<T> {
    this.map.set(key, { obj, refs: 1 });
    return {
      obj,
      release: () => this.release(key),
    };
  }

  private release(key: string) {
    const entry = this.map.get(key);
    if (!entry) return;

    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.obj.dispose();
      this.map.delete(key);
    }
  }
}
