export type Constructor<T> = new (...args: never[]) => T;
export type Factory<T> = (provider: FrameworkProvider) => T;

export class Framework {
  private factories = new Map<Constructor<unknown>, Factory<unknown>>();

  service<T>(token: Constructor<T>, factory: Factory<T>) {
    this.factories.set(token, factory);
    return this;
  }

  provider(parent: FrameworkProvider | null = null) {
    return new FrameworkProvider(this, parent);
  }

  getFactory<T>(token: Constructor<T>) {
    return this.factories.get(token) as Factory<T> | undefined;
  }
}

export class FrameworkProvider {
  private cache = new Map<Constructor<unknown>, unknown>();

  constructor(
    private framework: Framework,
    private parent: FrameworkProvider | null = null,
  ) {}

  get<T>(token: Constructor<T>): T {
    if (this.cache.has(token)) {
      return this.cache.get(token) as T;
    }

    const factory = this.framework.getFactory(token);
    if (!factory) {
      if (this.parent) {
        return this.parent.get(token);
      }

      throw new Error(`Service not found: ${token.name}`);
    }

    const instance = factory(this);
    this.cache.set(token, instance);

    return instance;
  }

  createChild(configure: (framework: Framework) => void) {
    const childFramework = new Framework();
    configure(childFramework);

    return childFramework.provider(this);
  }

  dispose() {
    for (const instance of this.cache.values()) {
      const disposable = instance as { dispose?: () => void };
      disposable.dispose?.();
    }

    this.cache.clear();
  }
}
